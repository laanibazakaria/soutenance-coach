import { NextResponse } from "next/server";
import { appelerGemini } from "@/lib/gemini";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptPitch, parsePitch } from "@/lib/pitch";
import { decouperSlide } from "@/lib/slides/analyse";
import type { Deck } from "@/lib/slides/types";

/** Script de présentation rédigé depuis les diapositives, calibré sur la durée. */

interface Corps {
  slides?: Array<{ numero?: number; titre?: string; texte?: string }>;
  nomFichier?: string;
  dureeMinutes?: number;
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
  if (slides.length === 0) {
    return NextResponse.json({ erreur: "Aucune diapositive exploitable." }, { status: 400 });
  }
  const duree = typeof corps.dureeMinutes === "number" && corps.dureeMinutes > 0 ? corps.dureeMinutes : 15;
  const deck: Deck = { nomFichier: corps.nomFichier ?? "support.pdf", slides };

  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerGemini(construirePromptPitch(deck, duree), {
    maxOutputTokens: 8000,
    temperature: 0.6,
    timeoutMs: 60_000,
  });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: 502 });
  }

  const pitch = parsePitch(resultat.texte, slides.length, duree);
  if (!pitch) {
    return NextResponse.json(
      { erreur: "Le script renvoyé était inexploitable. Réessaie.", code: "format" },
      { status: 502 },
    );
  }
  return NextResponse.json({ pitch });
}
