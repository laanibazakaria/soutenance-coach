import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptRapporteur, parseQuestionsRapporteur, LIMITES_RAPPORT } from "@/lib/rapport";

/** Vercel tue la route à ce plafond : mieux vaut le choisir que le subir. */
export const maxDuration = 90;

/** Les questions du rapporteur, depuis le texte du mémoire (jamais le fichier). */
export async function POST(request: Request) {
  let corps: { nomFichier?: unknown; pages?: unknown; texte?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const texte = typeof corps.texte === "string" ? corps.texte.trim() : "";
  if (texte.length < 500) return NextResponse.json({ erreur: "Le document est trop court pour en tirer des questions." }, { status: 400 });
  const rapport = {
    nomFichier: typeof corps.nomFichier === "string" ? corps.nomFichier.slice(0, 120) : "memoire.pdf",
    pages: typeof corps.pages === "number" ? corps.pages : 0,
    texte: texte.slice(0, LIMITES_RAPPORT.texteChars),
  };
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerIA(construirePromptRapporteur(rapport), { maxOutputTokens: 5000, temperature: 0.6, timeoutMs: 90_000 });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  }
  const questions = parseQuestionsRapporteur(resultat.texte);
  if (!questions) return NextResponse.json({ erreur: "La liste renvoyée était inexploitable. Réessaie.", code: "format" }, { status: 502 });
  return NextResponse.json({ questions });
}
