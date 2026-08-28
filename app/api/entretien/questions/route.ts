import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptQuestionsEntretien, parseQuestionsEntretien, estCandidature } from "@/lib/entretien";

/** Vercel tue la route à ce plafond : mieux vaut le choisir que le subir. */
export const maxDuration = 90;

/**
 * Questions d'entretien spécifiques au candidat : le navigateur envoie le
 * texte de l'offre et du CV (jamais le fichier). La clé reste ici.
 */
export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const candidature = (corps as { candidature?: unknown })?.candidature;
  if (!estCandidature(candidature)) {
    return NextResponse.json({ erreur: "Candidature manquante ou incomplète." }, { status: 400 });
  }
  if (!candidature.offre.trim() && !candidature.cvTexte.trim()) {
    return NextResponse.json({ erreur: "Il faut au moins l'offre ou le CV pour personnaliser les questions." }, { status: 400 });
  }

  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerIA(construirePromptQuestionsEntretien(candidature), { maxOutputTokens: 5000, temperature: 0.6 });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  }
  const questions = parseQuestionsEntretien(resultat.texte);
  if (!questions) {
    return NextResponse.json({ erreur: "La liste renvoyée était inexploitable. Réessaie.", code: "format" }, { status: 502 });
  }
  return NextResponse.json({ questions });
}
