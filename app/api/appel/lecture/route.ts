import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { PERSONAS, type ModeAppel } from "@/lib/appel";
import { construirePromptLecture, parseLecture, dossierSuffisant } from "@/lib/appel/lecture";

/**
 * Le jury lit le dossier avant la séance. Un seul appel, mis en cache côté
 * navigateur par empreinte du dossier : on ne relit pas le même document à
 * chaque entraînement.
 */
export async function POST(request: Request) {
  let corps: { mode?: unknown; dossier?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const mode = typeof corps.mode === "string" && corps.mode in PERSONAS ? (corps.mode as ModeAppel) : null;
  if (!mode) return NextResponse.json({ erreur: "Type d'oral inconnu." }, { status: 400 });
  const dossier = typeof corps.dossier === "string" ? corps.dossier : "";
  if (!dossierSuffisant(dossier)) {
    return NextResponse.json({ erreur: "Le dossier est trop mince pour être lu : dépose tes diapositives ou ton mémoire." }, { status: 400 });
  }

  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;

  const resultat = await appelerIA(construirePromptLecture(mode, dossier), { priorite: "qualite", maxOutputTokens: 2200, temperature: 0.4, timeoutMs: 40_000 });
  if (!resultat.ok) return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.status });

  const fiche = parseLecture(resultat.texte);
  if (!fiche) return NextResponse.json({ erreur: "La lecture du dossier n'a rien donné. Réessaie." }, { status: 502 });
  await quota.confirmer();
  return NextResponse.json({ fiche, fournisseur: resultat.fournisseur });
}
