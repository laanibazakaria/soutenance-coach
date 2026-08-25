import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { GRILLES, construirePrompt, normaliser, parseReponse, type IdOral, type Volet } from "@/lib/grille";

/**
 * Remplit la grille d'évaluation d'un oral. Le modèle juge critère par
 * critère ; la note pondérée est calculée ici, par du code — jamais par lui.
 */
const ORAUX: IdOral[] = ["soutenance", "entretien", "pitch", "concours"];
const LIMITES = { echange: 14_000, contexte: 6_000, mesures: 1_200 } as const;

export async function POST(request: Request) {
  let corps: { oral?: unknown; echange?: unknown; contexte?: unknown; mesures?: unknown; dureeMin?: unknown; volets?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const oral = ORAUX.includes(corps.oral as IdOral) ? (corps.oral as IdOral) : "soutenance";
  const echange = typeof corps.echange === "string" ? corps.echange.trim().slice(0, LIMITES.echange) : "";
  if (echange.length < 150) return NextResponse.json({ erreur: "L'échange est trop court pour être évalué." }, { status: 400 });

  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;

  // L'appel avec le jury ne comporte que des questions : l'exposé n'a pas eu
  // lieu, et rien du dialogue ne permet de le noter. La soutenance blanche
  // pourra, elle, demander les deux volets.
  const volets: Volet[] = Array.isArray(corps.volets) && corps.volets.includes("expose") ? ["expose", "questions"] : ["questions"];

  const prompt = construirePrompt({
    oral,
    echange,
    contexte: typeof corps.contexte === "string" ? corps.contexte.slice(0, LIMITES.contexte) : undefined,
    mesures: typeof corps.mesures === "string" ? corps.mesures.slice(0, LIMITES.mesures) : undefined,
    dureeMin: typeof corps.dureeMin === "number" ? corps.dureeMin : undefined,
    volets,
  });

  const resultat = await appelerIA(prompt, { priorite: "qualite", maxOutputTokens: 4500, temperature: 0.3 });
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.status });

  const brut = parseReponse(resultat.texte);
  const evaluation = normaliser(brut, GRILLES[oral], volets);
  if (evaluation.criteres.every((c) => c.note === null)) {
    return NextResponse.json({ erreur: "L'évaluation n'a pas abouti. Réessaie dans un instant." }, { status: 502 });
  }
  await quota.confirmer();
  return NextResponse.json({ evaluation, fournisseur: resultat.fournisseur });
}
