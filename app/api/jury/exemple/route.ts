import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptExemple, parseExemple, type DemandeExemple } from "@/lib/jury/exemple";

/** Un exemple de réponse excellente à une question, sur le dossier du candidat. */
export async function POST(request: Request) {
  let corps: Partial<DemandeExemple>;
  try {
    corps = (await request.json()) as Partial<DemandeExemple>;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (typeof corps.question !== "string" || corps.question.trim().length < 10) {
    return NextResponse.json({ erreur: "Question manquante." }, { status: 400 });
  }
  const demande: DemandeExemple = {
    question: corps.question.trim(),
    pourquoi: typeof corps.pourquoi === "string" ? corps.pourquoi : undefined,
    contexte: typeof corps.contexte === "string" ? corps.contexte : undefined,
    persona: typeof corps.persona === "string" && corps.persona.trim() ? corps.persona.slice(0, 60) : "Jury",
    reponseEtudiant: typeof corps.reponseEtudiant === "string" ? corps.reponseEtudiant : undefined,
    langue: corps.langue === "en" ? "en" : undefined,
  };
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerIA(construirePromptExemple(demande), { maxOutputTokens: 2500, temperature: 0.5 });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  const exemple = parseExemple(resultat.texte);
  if (!exemple) return NextResponse.json({ erreur: "L'exemple renvoyé était inexploitable. Réessaie.", code: "format" }, { status: 502 });
  return NextResponse.json({ exemple });
}
