import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptDebrief, parseDebrief, validerHistorique, PERSONAS, LIMITES_APPEL, type ModeAppel } from "@/lib/appel";
import { GRILLES, construirePrompt, normaliser, parseReponse, type Volet } from "@/lib/grille";

/** Deux appels modèle qui peuvent durer : on prend la place de les mener. */
export const maxDuration = 120;

/**
 * Le débrief ET la grille, en un seul passage — deux regards sur le même
 * dialogue, deux appels modèle en parallèle, mais UNE unité de quota.
 *
 * C'étaient deux routes facturées séparément : un appel complet coûtait quatre
 * unités (lecture, lancement, débrief, grille), soit six oraux par mois. À
 * trois unités, c'en est neuf — et le quota est la ressource la plus rare de
 * la plateforme.
 */
export async function POST(request: Request) {
  let corps: { mode?: unknown; contexte?: unknown; langue?: unknown; dureeMin?: unknown; historique?: unknown; mesures?: unknown; souvenirs?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const mode = typeof corps.mode === "string" && corps.mode in PERSONAS ? (corps.mode as ModeAppel) : null;
  if (!mode) return NextResponse.json({ erreur: "Type d'oral inconnu." }, { status: 400 });
  const historique = validerHistorique(corps.historique);
  if (historique.filter((m) => m.role === "user").length < 1) return NextResponse.json({ erreur: "Aucune réponse à débriefer." }, { status: 400 });
  const langue = corps.langue === "en" ? ("en" as const) : ("fr" as const);
  const dureeMin = typeof corps.dureeMin === "number" ? Math.round(corps.dureeMin) : 10;
  const contexte = {
    mode,
    contexte: typeof corps.contexte === "string" ? corps.contexte.slice(0, LIMITES_APPEL.contexteChars) : "",
    langue,
    dureeMin,
    historique,
    souvenirs: typeof corps.souvenirs === "string" ? corps.souvenirs.slice(0, 2000) : undefined,
  };

  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;

  // L'appel ne comporte que des questions : la grille ne juge que ce volet.
  const volets: Volet[] = ["questions"];
  const echange = historique.map((m) => `${m.role === "assistant" ? "JURY" : "CANDIDAT"} : ${m.content}`).join("\n\n");
  const promptGrille = construirePrompt({
    oral: mode,
    echange: echange.slice(0, 14_000),
    contexte: contexte.contexte.slice(0, 4_000),
    mesures: typeof corps.mesures === "string" ? corps.mesures.slice(0, 1_200) : undefined,
    dureeMin,
    volets,
    langue,
  });

  const [rDebrief, rGrille] = await Promise.all([
    appelerIA(construirePromptDebrief(contexte, historique), { priorite: "qualite", maxOutputTokens: 3000, temperature: 0.4, timeoutMs: 60_000 }),
    appelerIA(promptGrille, { priorite: "qualite", maxOutputTokens: 4500, temperature: 0.3, timeoutMs: 60_000 }),
  ]);

  // Le débrief reste la pièce maîtresse : sans lui, on ne facture rien et on
  // le dit. La grille, elle, peut manquer sans invalider le reste — le client
  // affiche alors le débrief seul, comme avant.
  if (!rDebrief.ok) return NextResponse.json({ erreur: rDebrief.erreur, code: rDebrief.code }, { status: rDebrief.code === "cle_absente" ? 503 : 502 });
  const debrief = parseDebrief(rDebrief.texte);
  if (!debrief) return NextResponse.json({ erreur: "Le débrief renvoyé était inexploitable. Réessaie.", code: "format" }, { status: 502 });

  let evaluation = null;
  if (rGrille.ok) {
    const brut = parseReponse(rGrille.texte);
    const e = normaliser(brut, GRILLES[mode], volets);
    if (!e.criteres.every((c) => c.note === null)) evaluation = e;
  }

  await quota.confirmer();
  return NextResponse.json({ debrief, evaluation, fournisseur: rDebrief.fournisseur });
}
