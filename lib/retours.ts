/**
 * Les vraies questions des vrais jurys : après son oral, l'étudiant note
 * (anonymement, s'il le veut) les questions qu'on lui a réellement posées.
 * Avec le temps, une base par école et par filière que personne d'autre
 * n'a. Modérée avant publication.
 */

export type TypeOral = "soutenance" | "entretien" | "pitch" | "concours";

export interface RetourOral {
  type: TypeOral;
  ecole: string;
  filiere: string;
  niveau: string;
  annee: number;
  questions: string[];
  ressenti?: string;
  conseil?: string;
}

export const LIMITES_RETOUR = { questionsMax: 15, questionChars: 300, champChars: 80, texteChars: 600, questionsMin: 1 } as const;
export const TYPES_ORAL: readonly TypeOral[] = ["soutenance", "entretien", "pitch", "concours"];
export const LIBELLES_TYPE_ORAL: Record<TypeOral, string> = { soutenance: "Soutenance", entretien: "Entretien d'embauche", pitch: "Pitch de projet", concours: "Oral de concours" };

function champ(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/** Valide et nettoie un retour. Renvoie null si inexploitable. */
export function validerRetourOral(brut: unknown, anneeCourante: number): RetourOral | null {
  if (!brut || typeof brut !== "object") return null;
  const r = brut as Record<string, unknown>;
  if (!TYPES_ORAL.includes(r.type as TypeOral)) return null;
  const questions = (Array.isArray(r.questions) ? r.questions : typeof r.questions === "string" ? r.questions.split(/\r?\n/) : [])
    .map((q) => champ(q, LIMITES_RETOUR.questionChars))
    .filter((q) => q.length >= 12)
    .slice(0, LIMITES_RETOUR.questionsMax);
  if (questions.length < LIMITES_RETOUR.questionsMin) return null;
  const annee = typeof r.annee === "number" && r.annee >= anneeCourante - 5 && r.annee <= anneeCourante ? Math.round(r.annee) : anneeCourante;
  const ressenti = champ(r.ressenti, LIMITES_RETOUR.texteChars);
  const conseil = champ(r.conseil, LIMITES_RETOUR.texteChars);
  return {
    type: r.type as TypeOral,
    ecole: champ(r.ecole, LIMITES_RETOUR.champChars) || "Non précisée",
    filiere: champ(r.filiere, LIMITES_RETOUR.champChars) || "Non précisée",
    niveau: champ(r.niveau, LIMITES_RETOUR.champChars) || "Non précisé",
    annee,
    questions: [...new Set(questions)],
    ...(ressenti ? { ressenti } : {}),
    ...(conseil ? { conseil } : {}),
  };
}

/** Regroupe des retours approuvés par école puis filière, questions dédoublonnées. */
export function regrouper(retours: (RetourOral & { creeLe: string })[]): { ecole: string; filiere: string; type: TypeOral; nb: number; questions: string[]; conseils: string[] }[] {
  const groupes = new Map<string, { ecole: string; filiere: string; type: TypeOral; nb: number; questions: Set<string>; conseils: string[] }>();
  for (const r of retours) {
    const cle = `${r.type}|${r.ecole.toLowerCase()}|${r.filiere.toLowerCase()}`;
    const g = groupes.get(cle) ?? { ecole: r.ecole, filiere: r.filiere, type: r.type, nb: 0, questions: new Set<string>(), conseils: [] };
    g.nb++;
    r.questions.forEach((q) => g.questions.add(q));
    if (r.conseil) g.conseils.push(r.conseil);
    groupes.set(cle, g);
  }
  return [...groupes.values()].map((g) => ({ ...g, questions: [...g.questions] })).sort((a, b) => b.nb - a.nb || a.ecole.localeCompare(b.ecole));
}
