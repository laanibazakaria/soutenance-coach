import { NextResponse } from "next/server";
import { appelerGemini } from "@/lib/gemini";
import { verifierQuota } from "@/lib/quota-serveur";
import { analyserReponse, parseAvis } from "@/lib/jury/evaluation";
import { MODULES, estModuleId, construirePromptEvaluationModule } from "@/lib/modules";
import type { QuestionEntretien } from "@/lib/entretien";

interface Corps {
  module?: unknown;
  question?: QuestionEntretien;
  reponse?: string;
  latenceMs?: number;
  profil?: { champs?: Record<string, string>; documentTexte?: string };
  langue?: string;
}

/** Avis du jury du module sur une réponse orale — mesures d'abord, jamais de note. */
export async function POST(request: Request) {
  let corps: Corps;
  try {
    corps = (await request.json()) as Corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (!estModuleId(corps.module)) return NextResponse.json({ erreur: "Module inconnu." }, { status: 400 });
  const { question, reponse, latenceMs } = corps;
  if (!question?.question || typeof reponse !== "string") {
    return NextResponse.json({ erreur: "Question ou réponse manquante." }, { status: 400 });
  }
  const m = MODULES[corps.module];
  const profil =
    corps.profil && typeof corps.profil === "object"
      ? { champs: Object.fromEntries(Object.entries(corps.profil.champs ?? {}).map(([k, v]) => [k, String(v)])), documentTexte: String(corps.profil.documentTexte ?? "") }
      : undefined;

  const analyse = analyserReponse(reponse, latenceMs);
  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerGemini(construirePromptEvaluationModule(m, { question, reponse, profil, langue: corps.langue === "en" ? "en" : undefined }, analyse), { maxOutputTokens: 3000, temperature: 0.4 });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json({ erreur: `${resultat.erreur} Les mesures automatiques restent disponibles.`, code: resultat.code, analyse }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  }
  const avis = parseAvis(resultat.texte);
  if (!avis) return NextResponse.json({ erreur: "L'avis renvoyé était inexploitable. Les mesures restent valables.", code: "format", analyse }, { status: 502 });
  return NextResponse.json({ avis, analyse });
}
