import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptTour, parseTour, validerHistorique, PERSONAS, LIMITES_APPEL, type ModeAppel } from "@/lib/appel";

/**
 * Un tour de l'appel avec le jury : l'historique complet arrive, le jury
 * répond (question, relance ou conclusion). Le quota n'est consommé qu'au
 * premier tour : un appel entier compte pour un.
 */
export async function POST(request: Request) {
  let corps: { mode?: unknown; contexte?: unknown; langue?: unknown; dureeMin?: unknown; ecouleS?: unknown; historique?: unknown; dejaPosees?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const mode = typeof corps.mode === "string" && corps.mode in PERSONAS ? (corps.mode as ModeAppel) : null;
  if (!mode) return NextResponse.json({ erreur: "Type d'oral inconnu." }, { status: 400 });
  const historique = validerHistorique(corps.historique);
  const contexte = {
    mode,
    contexte: typeof corps.contexte === "string" ? corps.contexte.slice(0, LIMITES_APPEL.contexteChars) : "",
    langue: corps.langue === "en" ? ("en" as const) : ("fr" as const),
    dureeMin: typeof corps.dureeMin === "number" && corps.dureeMin >= 3 && corps.dureeMin <= 30 ? Math.round(corps.dureeMin) : 10,
    historique,
    graine: Math.floor(Math.random() * 10_000),
    dejaPosees: Array.isArray(corps.dejaPosees) ? (corps.dejaPosees as unknown[]).filter((q): q is string => typeof q === "string").map((q) => q.slice(0, 200)).slice(0, 25) : undefined,
  };
  const ecouleS = typeof corps.ecouleS === "number" && corps.ecouleS >= 0 ? Math.round(corps.ecouleS) : 0;

  let confirmer: (() => Promise<void>) | null = null;
  if (historique.length === 0) {
    const quota = await verifierQuota(request);
    if (!quota.ok) return quota.reponse;
    confirmer = quota.confirmer;
  }

  const resultat = await appelerIA(construirePromptTour(contexte, ecouleS), {
    messages: historique.length === 0 ? [{ role: "user", content: contexte.langue === "en" ? "(The candidate has just finished presenting.)" : "(Le candidat vient de terminer sa présentation.)" }] : historique,
    priorite: "rapide",
    maxOutputTokens: 400,
    // Plus chaud à l ouverture : c est là que les formules toutes faites reviennent.
    temperature: historique.length === 0 ? 1 : 0.8,
    timeoutMs: 25_000,
  });
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  const tour = parseTour(resultat.texte, contexte.mode);
  if (!tour) return NextResponse.json({ erreur: "Le jury a bafouillé. Réessaie.", code: "format" }, { status: 502 });
  if (confirmer) await confirmer();
  return NextResponse.json({ ...tour, fournisseur: resultat.fournisseur });
}
