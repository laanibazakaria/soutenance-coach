import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { decouperSlide } from "@/lib/slides/analyse";
import { construirePromptRelecture, parseRelecture, resumerPortee, LIMITES_RELECTURE } from "@/lib/dossier/relecture";
import type { Deck } from "@/lib/slides/types";

/** Vercel tue la route à ce plafond : mieux vaut le choisir que le subir. */
export const maxDuration = 120;

/**
 * La relecture du dossier : le seul appel de la plateforme qui voit la
 * présentation et le rapport dans le même contexte, et peut donc les
 * confronter. C'est le premier geste d'un rapporteur.
 */

interface Corps {
  slides?: Array<{ numero?: number; titre?: string; texte?: string }>;
  nomFichier?: string;
  rapport?: string;
}

export async function POST(request: Request) {
  let corps: Corps;
  try {
    corps = (await request.json()) as Corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const slides = (corps.slides ?? [])
    .filter((s) => typeof s.texte === "string" && typeof s.numero === "number")
    .map((s) => decouperSlide(s.numero as number, `${s.titre ?? ""}\n${s.texte}`));
  const rapport = typeof corps.rapport === "string" ? corps.rapport.trim() : "";

  // Confronter suppose deux documents. Avec un seul, il n'y a rien à
  // confronter — et le dire vaut mieux que rendre une analyse à moitié.
  if (slides.length === 0 || rapport.length < 500) {
    return NextResponse.json(
      { erreur: "La relecture confronte tes deux documents : dépose ta présentation ET ton rapport." },
      { status: 400 },
    );
  }

  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;

  const deck: Deck = { nomFichier: corps.nomFichier ?? "presentation.pdf", slides };
  const rapportTronque = rapport.length > LIMITES_RELECTURE.rapportChars;
  const prompt = construirePromptRelecture({ deck, rapport, rapportTronque });

  // Deux tentatives : une réponse mal formée arrive, et refaire lire tout le
  // dossier au candidat pour un JSON bancal serait absurde.
  let relecture = null;
  let echec: { erreur: string; code: string; status: number } | null = null;
  for (let essai = 0; essai < 2 && !relecture; essai++) {
    const r = await appelerIA(prompt, {
      priorite: "qualite",
      maxOutputTokens: 4000,
      temperature: essai === 0 ? 0.3 : 0.15,
      timeoutMs: 90_000,
    });
    if (!r.ok) {
      echec = { erreur: r.erreur, code: r.code, status: r.status };
      break;
    }
    relecture = parseRelecture(r.texte);
  }

  if (!relecture) {
    if (echec) return NextResponse.json({ erreur: echec.erreur, code: echec.code }, { status: echec.status });
    return NextResponse.json({ erreur: "La relecture n'a rien donné de lisible. Réessaie." }, { status: 502 });
  }

  await quota.confirmer();
  return NextResponse.json({
    relecture,
    portee: resumerPortee(deck, rapport.length),
    tronque: rapportTronque,
  });
}
