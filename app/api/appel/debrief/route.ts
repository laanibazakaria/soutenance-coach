import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptDebrief, parseDebrief, validerHistorique, PERSONAS, LIMITES_APPEL, type ModeAppel } from "@/lib/appel";

/** Le débrief complet de l'appel, comme un coach qui y a assisté. Un appel IA. */
export async function POST(request: Request) {
  let corps: { mode?: unknown; contexte?: unknown; langue?: unknown; dureeMin?: unknown; historique?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const mode = typeof corps.mode === "string" && corps.mode in PERSONAS ? (corps.mode as ModeAppel) : null;
  if (!mode) return NextResponse.json({ erreur: "Type d'oral inconnu." }, { status: 400 });
  const historique = validerHistorique(corps.historique);
  if (historique.filter((m) => m.role === "user").length < 1) return NextResponse.json({ erreur: "Aucune réponse à débriefer." }, { status: 400 });
  const contexte = {
    mode,
    contexte: typeof corps.contexte === "string" ? corps.contexte.slice(0, LIMITES_APPEL.contexteChars) : "",
    langue: corps.langue === "en" ? ("en" as const) : ("fr" as const),
    dureeMin: typeof corps.dureeMin === "number" ? Math.round(corps.dureeMin) : 10,
    historique,
  };
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerIA(construirePromptDebrief(contexte, historique), { priorite: "qualite", maxOutputTokens: 3000, temperature: 0.4, timeoutMs: 60_000 });
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  const debrief = parseDebrief(resultat.texte);
  if (!debrief) return NextResponse.json({ erreur: "Le débrief renvoyé était inexploitable. Réessaie.", code: "format" }, { status: 502 });
  await quota.confirmer();
  return NextResponse.json({ debrief, fournisseur: resultat.fournisseur });
}
