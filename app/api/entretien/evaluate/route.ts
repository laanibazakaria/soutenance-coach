import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { analyserReponse, parseAvis } from "@/lib/jury/evaluation";
import { construirePromptEvaluationEntretien, type QuestionEntretien, type RoleRecruteur } from "@/lib/entretien";

/** Vercel tue la route à ce plafond : mieux vaut le choisir que le subir. */
export const maxDuration = 60;

/**
 * Avis du recruteur sur une réponse orale. Mesures déterministes d'abord
 * (partagées avec le jury), avis qualitatif ensuite — jamais de note.
 */

interface Corps {
  question?: QuestionEntretien;
  reponse?: string;
  latenceMs?: number;
  role?: RoleRecruteur;
  candidature?: { poste?: string; entreprise?: string; offre?: string; cvTexte?: string };
  langue?: string;
}

export async function POST(request: Request) {
  let corps: Corps;
  try {
    corps = (await request.json()) as Corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const { question, reponse, latenceMs } = corps;
  if (!question?.question || typeof reponse !== "string") {
    return NextResponse.json({ erreur: "Question ou réponse manquante." }, { status: 400 });
  }
  const role: RoleRecruteur = corps.role === "technique" ? "technique" : "rh";
  const c = corps.candidature;
  const candidature =
    c && typeof c === "object"
      ? { poste: String(c.poste ?? ""), entreprise: String(c.entreprise ?? ""), offre: String(c.offre ?? ""), cvTexte: String(c.cvTexte ?? "") }
      : undefined;

  const analyse = analyserReponse(reponse, latenceMs);
  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerIA(construirePromptEvaluationEntretien({ question, reponse, role, candidature, langue: corps.langue === "en" ? "en" : undefined }, analyse), {
    maxOutputTokens: 3000,
    temperature: 0.4,
  });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json(
      { erreur: `${resultat.erreur} Les mesures automatiques restent disponibles.`, code: resultat.code, analyse },
      { status: resultat.code === "cle_absente" ? 503 : 502 },
    );
  }
  const avis = parseAvis(resultat.texte);
  if (!avis) {
    return NextResponse.json({ erreur: "L'avis renvoyé était inexploitable. Les mesures restent valables.", code: "format", analyse }, { status: 502 });
  }
  return NextResponse.json({ avis, analyse });
}
