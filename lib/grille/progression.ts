/**
 * La progression d'un oral à l'autre : c'est ce qui transforme une note en
 * parcours. Pour chaque critère, on regarde ce qu'il valait la première fois
 * et ce qu'il vaut maintenant — et on dit lequel a bougé.
 *
 * Règle du projet, ici aussi : rien n'est déclaré tant qu'il n'y a pas assez
 * de mesures. Deux oraux, c'est deux points ; on ne trace pas une tendance
 * avec deux points, on constate un écart.
 */

import { GRILLES, NOTE_MAX, type Evaluation, type IdOral } from "./index";

export interface EvaluationDatee {
  date: string;
  evaluation: Evaluation;
}

export const SEUILS_PROGRESSION = {
  /** En dessous, on ne compare rien. */
  oraux: 2,
  /** Un écart plus petit n'est que du bruit d'évaluation. */
  ecartSignificatif: 1,
} as const;

export type SensProgression = "monte" | "stable" | "descend";

export interface CritereSuivi {
  id: number;
  titre: string;
  poids: number;
  premiere: number;
  derniere: number;
  ecart: number;
  sens: SensProgression;
  /** Toutes les notes connues, dans l'ordre chronologique. */
  notes: number[];
}

export interface Progression {
  oral: IdOral;
  /** Nombre d'oraux comparés. */
  oraux: number;
  noteDebut: number | null;
  noteFin: number | null;
  ecartNote: number | null;
  sens: SensProgression;
  criteres: CritereSuivi[];
  /** Ce qui a le plus progressé (écart ≥ 1), du plus fort au moins fort. */
  progresse: CritereSuivi[];
  /** Ce qui reste bas malgré les répétitions : note finale < 6, sans progression. */
  bloque: CritereSuivi[];
  exploitable: boolean;
}

function sens(ecart: number): SensProgression {
  if (ecart >= SEUILS_PROGRESSION.ecartSignificatif) return "monte";
  if (ecart <= -SEUILS_PROGRESSION.ecartSignificatif) return "descend";
  return "stable";
}

const arrondi = (n: number) => Math.round(n * 10) / 10;

/**
 * Compare les évaluations d'un même type d'oral, de la plus ancienne à la
 * plus récente. Les entrées non datées ou d'un autre oral sont ignorées.
 */
export function suivre(historique: EvaluationDatee[], oral: IdOral): Progression {
  const retenues = historique
    .filter((e) => e.evaluation?.oral === oral && typeof e.date === "string")
    .sort((a, b) => a.date.localeCompare(b.date));

  const vide: Progression = { oral, oraux: retenues.length, noteDebut: null, noteFin: null, ecartNote: null, sens: "stable", criteres: [], progresse: [], bloque: [], exploitable: false };
  if (retenues.length < SEUILS_PROGRESSION.oraux) return vide;

  const criteres: CritereSuivi[] = [];
  for (const def of GRILLES[oral].criteres) {
    const notes = retenues.map((e) => e.evaluation.criteres.find((c) => c.id === def.id)?.note).filter((n): n is number => typeof n === "number");
    if (notes.length < SEUILS_PROGRESSION.oraux) continue;
    const premiere = notes[0]!;
    const derniere = notes[notes.length - 1]!;
    const ecart = arrondi(derniere - premiere);
    criteres.push({ id: def.id, titre: def.titre, poids: def.poids, premiere, derniere, ecart, sens: sens(ecart), notes });
  }

  const avecNote = retenues.filter((e) => e.evaluation.note !== null);
  const noteDebut = avecNote.length >= 2 ? avecNote[0]!.evaluation.note : null;
  const noteFin = avecNote.length >= 2 ? avecNote[avecNote.length - 1]!.evaluation.note : null;
  const ecartNote = noteDebut !== null && noteFin !== null ? arrondi(noteFin - noteDebut) : null;

  const progresse = criteres.filter((c) => c.sens === "monte").sort((a, b) => b.ecart - a.ecart);
  // Ce qui bloque : bas ET qui ne bouge pas. Un critère bas qui monte n'est pas bloqué.
  const bloque = criteres.filter((c) => c.derniere < 6 && c.sens !== "monte").sort((a, b) => (NOTE_MAX - a.derniere) * a.poids > (NOTE_MAX - b.derniere) * b.poids ? -1 : 1);

  return {
    oral,
    oraux: retenues.length,
    noteDebut,
    noteFin,
    ecartNote,
    sens: ecartNote === null ? "stable" : sens(ecartNote),
    criteres,
    progresse,
    bloque,
    exploitable: criteres.length > 0,
  };
}

/** Une phrase d'ensemble, honnête : ni félicitations creuses, ni découragement. */
export function resumer(p: Progression): string {
  if (!p.exploitable) return `Encore un oral et je pourrai te dire ce qui progresse : il en faut ${SEUILS_PROGRESSION.oraux} sur le même type pour comparer.`;
  const morceaux: string[] = [];
  if (p.ecartNote !== null && p.sens === "monte") morceaux.push(`Tu passes de ${p.noteDebut} à ${p.noteFin} sur ${p.oraux} oraux.`);
  else if (p.ecartNote !== null && p.sens === "descend") morceaux.push(`Ta note baisse de ${p.noteDebut} à ${p.noteFin} — souvent le signe d'un jury plus dur sur un sujet mieux préparé.`);
  else if (p.ecartNote !== null) morceaux.push(`Ta note reste autour de ${p.noteFin} sur ${p.oraux} oraux.`);

  if (p.progresse.length > 0) {
    const t = p.progresse[0]!;
    morceaux.push(`${t.titre} progresse nettement : ${t.premiere} → ${t.derniere}.`);
  }
  if (p.bloque.length > 0) {
    const b = p.bloque[0]!;
    morceaux.push(`${b.titre} ne bouge pas (${b.derniere}/10) — c'est là qu'il faut travailler autrement, pas plus.`);
  } else if (p.progresse.length === 0) {
    morceaux.push("Rien n'a bougé de façon nette d'un oral à l'autre.");
  }
  return morceaux.join(" ");
}

/** Le préfixe des appels dans le cache IA — les grilles y sont rangées. */
/** Les deux sources de grilles : l'appel (questions) et la blanche (oral entier). */
const PREFIXES_CACHE = ["sc.ia.v1:appel:", "sc.ia.v1:blanche:"] as const;

interface AppelStocke {
  grille?: Evaluation | null;
  date?: string;
}

/**
 * Relit tous les appels de l'appareil et en tire les grilles. On lit le
 * stockage directement : les appels ne sont pas indexés ailleurs, et une
 * boucle sur quelques dizaines de clés coûte moins qu'un index à tenir.
 */
export function historiqueDepuisStockage(storage: Storage): EvaluationDatee[] {
  const sorties: EvaluationDatee[] = [];
  for (let i = 0; i < storage.length; i++) {
    const cle = storage.key(i);
    if (!cle || !PREFIXES_CACHE.some((p) => cle.startsWith(p))) continue;
    try {
      const brut = JSON.parse(storage.getItem(cle) ?? "null") as { valeur?: AppelStocke } | AppelStocke | null;
      const appel = (brut && typeof brut === "object" && "valeur" in brut ? brut.valeur : brut) as AppelStocke | null;
      const date = appel?.date ?? (appel as { faitLe?: string } | null)?.faitLe;
      if (appel?.grille && date) sorties.push({ date, evaluation: appel.grille });
    } catch {
      /* entrée illisible : on l'ignore */
    }
  }
  return sorties;
}
