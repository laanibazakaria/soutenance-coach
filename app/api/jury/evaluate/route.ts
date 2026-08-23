import { NextResponse } from "next/server";
import { appelerGemini } from "@/lib/gemini";
import { verifierQuota } from "@/lib/quota-serveur";
import { analyserReponse, construirePrompt, parseAvis } from "@/lib/jury/evaluation";
import type { JuryQuestion } from "@/lib/slides/types";

/**
 * Évaluation d'une réponse orale. Le modèle ne reçoit que la question, la
 * réponse transcrite et les mesures déjà calculées ; il ne produit que du
 * qualitatif (garde-fou du projet).
 */

interface CorpsRequete {
  question?: JuryQuestion;
  reponse?: string;
  latenceMs?: number;
  contexteSlides?: string;
}

export async function POST(request: Request) {
  let corps: CorpsRequete;
  try {
    corps = (await request.json()) as CorpsRequete;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const { question, reponse, latenceMs, contexteSlides } = corps;
  if (!question?.question || typeof reponse !== "string") {
    return NextResponse.json({ erreur: "Question ou réponse manquante." }, { status: 400 });
  }

  const analyse = analyserReponse(reponse, latenceMs);
  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerGemini(
    construirePrompt({ question, reponse, contexteSlides }, analyse),
    { maxOutputTokens: 3000, temperature: 0.4 },
  );
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json(
      { erreur: `${resultat.erreur} Les mesures automatiques restent disponibles.`, code: resultat.code, analyse },
      { status: resultat.code === "cle_absente" ? 503 : 502 },
    );
  }

  const avis = parseAvis(resultat.texte);
  if (!avis) {
    return NextResponse.json(
      { erreur: "L'avis renvoyé était inexploitable. Les mesures automatiques restent valables.", code: "format", analyse },
      { status: 502 },
    );
  }
  return NextResponse.json({ avis, analyse });
}
