import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { PERSONAS, type ModeAppel } from "@/lib/appel";
import { construirePromptLecture, parseLecture, fusionnerFiches, decouperDossier, passesARetenir, dossierSuffisant, DOSSIER_MAX, type FicheLecture } from "@/lib/appel/lecture";

/**
 * Le jury lit le dossier avant la séance — en entier. Un mémoire ne tient pas
 * dans un seul appel : on le découpe en passes, et le jury complète ses notes
 * à chaque partie plutôt que de tout relire. Un seul quota consommé, quel que
 * soit le nombre de passes : c'est la même lecture.
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
  const dossier = typeof corps.dossier === "string" ? corps.dossier.slice(0, DOSSIER_MAX) : "";
  if (!dossierSuffisant(dossier)) {
    return NextResponse.json({ erreur: "Le dossier est trop mince pour être lu : dépose tes diapositives ou ton mémoire." }, { status: 400 });
  }

  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;

  const toutes = decouperDossier(dossier);
  const passes = passesARetenir(toutes);
  const fiches: FicheLecture[] = [];
  let ratees = 0;
  for (const [i, partie] of passes.entries()) {
    const prompt = construirePromptLecture(mode, partie, { numero: i + 1, total: passes.length, dejaNote: fusionnerFiches(fiches) ?? undefined });
    // Deux tentatives par partie : une réponse mal formée arrive de temps en
    // temps, et perdre une passe reviendrait à sauter trente pages du dossier.
    let fiche: FicheLecture | null = null;
    let echec: { erreur: string; code: string; status: number } | null = null;
    for (let essai = 0; essai < 2 && !fiche; essai++) {
      const r = await appelerIA(prompt, { priorite: "qualite", maxOutputTokens: 3000, temperature: essai === 0 ? 0.4 : 0.2, timeoutMs: 60_000 });
      if (!r.ok) {
        echec = { erreur: r.erreur, code: r.code, status: r.status };
        break;
      }
      fiche = parseLecture(r.texte);
    }
    if (fiche) fiches.push(fiche);
    else {
      ratees++;
      // Rien de lu du tout : on le dit. Sinon on continue — mieux vaut le
      // reste du dossier qu'un échec sec.
      if (fiches.length === 0 && echec) return NextResponse.json({ erreur: echec.erreur, code: echec.code }, { status: echec.status });
    }
  }

  const fiche = fusionnerFiches(fiches);
  if (!fiche) return NextResponse.json({ erreur: "La lecture du dossier n'a rien donné. Réessaie." }, { status: 502 });
  await quota.confirmer();
  return NextResponse.json({ fiche, passes: fiches.length, surTotal: toutes.length, ratees, caracteres: dossier.length });
}
