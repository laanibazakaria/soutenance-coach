import { NextResponse } from "next/server";
import { appelerGemini } from "@/lib/gemini";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptQuestions, parseQuestionsGenerees } from "@/lib/jury/generation";
import { decouperSlide } from "@/lib/slides/analyse";
import type { Deck } from "@/lib/slides/types";

/**
 * Questions de jury spécifiques au projet, générées depuis les diapositives.
 * Le navigateur envoie le texte extrait (jamais le PDF) ; la clé reste ici.
 */

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
  const deck: Deck = { nomFichier: corps.nomFichier ?? "support.pdf", slides };

  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerGemini(
    construirePromptQuestions(deck, { nombre: 10, dureeMinutes: corps.dureeMinutes }),
    { maxOutputTokens: 5000, temperature: 0.6 },
  );
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: 502 });
  }

  const questions = parseQuestionsGenerees(resultat.texte, slides.length);
  if (!questions) {
    return NextResponse.json(
      { erreur: "La liste renvoyée était inexploitable. Réessaie.", code: "format" },
      { status: 502 },
    );
  }
  return NextResponse.json({ questions });
}
