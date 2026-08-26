/**
 * La mémoire du jury : ce qu'il retient d'un appel à l'autre.
 *
 * C'est la pièce qui transforme des appels isolés en une relation. Le jury
 * rouvre sur la question ratée la dernière fois, revient sur les critères
 * faibles jusqu'à ce qu'ils tombent, et reconnaît à voix haute les progrès —
 * « Bien. Cette fois vous avez le chiffre. » Battre le jury sur la question
 * qui vous avait fait échouer : c'est ça, la progression qu'on vit.
 *
 * Tout vient de ce que la plateforme stocke déjà : la grille de chaque appel
 * (notes et constats par critère) et son débrief (les moments manqués, avec
 * ce qu'une meilleure réponse aurait contenu). Fonctions pures, testables.
 */

import type { StorageLike } from "../types";
import type { Evaluation } from "../grille";
import type { Debrief } from "./index";
import type { ModeAppel } from "./index";

export interface Faiblesse {
  critere: string;
  note: number;
  /** Le constat du jury, tel qu'il l'a écrit. */
  constat: string;
}

export interface QuestionRatee {
  question: string;
  /** Ce qu'une meilleure réponse aurait contenu — le jury sait ce qu'il attend. */
  attendu: string;
}

export interface Progres {
  critere: string;
  avant: number;
  apres: number;
}

export interface Souvenirs {
  nbAppels: number;
  dernierLe: string;
  /** Les critères encore faibles au dernier appel, du plus coûteux au moins. */
  faiblesses: Faiblesse[];
  /** Les questions restées sans bonne réponse au dernier appel. */
  questionsRatees: QuestionRatee[];
  /** Ce qui a monté d'au moins deux points entre les deux derniers appels. */
  progres: Progres[];
}

export const LIMITES_SOUVENIRS = { faiblesses: 3, questions: 3, progres: 3, blocChars: 1_800 } as const;

interface AppelStocke {
  mode?: string;
  date?: string;
  grille?: Evaluation | null;
  debrief?: Debrief | null;
}

/** Les appels du mode, du plus ancien au plus récent. */
function appelsDuMode(storage: StorageLike, mode: ModeAppel): AppelStocke[] {
  const st = storage as unknown as { length?: number; key?: (i: number) => string | null };
  if (typeof st.length !== "number" || typeof st.key !== "function") return [];
  const trouves: AppelStocke[] = [];
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (!k || !k.startsWith("sc.ia.v1:appel:")) continue;
    try {
      const v = JSON.parse(storage.getItem(k) ?? "null") as AppelStocke | null;
      if (v && v.mode === mode && typeof v.date === "string") trouves.push(v);
    } catch {
      // Une entrée corrompue n'efface pas la mémoire.
    }
  }
  return trouves.sort((a, b) => (a.date! < b.date! ? -1 : 1));
}

const notesParCritere = (e: Evaluation | null | undefined): Map<string, { titre: string; note: number; poids: number; constat: string }> => {
  const m = new Map<string, { titre: string; note: number; poids: number; constat: string }>();
  for (const c of e?.criteres ?? []) {
    if (c.note !== null) m.set(String(c.id), { titre: c.titre, note: c.note, poids: c.poids, constat: c.constat });
  }
  return m;
};

/** Ce que le jury retient, ou null s'il n'a jamais entendu ce candidat. */
export function lireSouvenirs(storage: StorageLike, mode: ModeAppel): Souvenirs | null {
  const appels = appelsDuMode(storage, mode);
  if (appels.length === 0) return null;
  const dernier = appels[appels.length - 1]!;
  const avantDernier = appels.length > 1 ? appels[appels.length - 2] : null;

  const actuelles = notesParCritere(dernier.grille);
  const anciennes = notesParCritere(avantDernier?.grille);

  // Les faiblesses : sous 6, triées par ce qu'elles coûtent (poids × écart).
  const faiblesses: Faiblesse[] = [...actuelles.values()]
    .filter((c) => c.note < 6)
    .sort((a, b) => (10 - b.note) * b.poids - (10 - a.note) * a.poids)
    .slice(0, LIMITES_SOUVENIRS.faiblesses)
    .map((c) => ({ critere: c.titre, note: c.note, constat: c.constat.slice(0, 200) }));

  // Les progrès : au moins deux points gagnés d'un appel à l'autre.
  const progres: Progres[] = [];
  for (const [id, c] of actuelles) {
    const avant = anciennes.get(id);
    if (avant && c.note - avant.note >= 2) progres.push({ critere: c.titre, avant: avant.note, apres: c.note });
  }
  progres.sort((a, b) => b.apres - b.avant - (a.apres - a.avant));

  const questionsRatees: QuestionRatee[] = (dernier.debrief?.momentsManques ?? [])
    .filter((m) => m.question && m.mieux)
    .slice(0, LIMITES_SOUVENIRS.questions)
    .map((m) => ({ question: m.question.slice(0, 240), attendu: m.mieux.slice(0, 240) }));

  return {
    nbAppels: appels.length,
    dernierLe: dernier.date!,
    faiblesses,
    questionsRatees,
    progres: progres.slice(0, LIMITES_SOUVENIRS.progres),
  };
}

/**
 * Le bloc que reçoivent les prompts du jury. Des faits, pas des consignes :
 * la conduite à tenir vit dans construirePromptTour, à côté des autres règles.
 */
export function formaterSouvenirs(s: Souvenirs | null): string {
  if (!s || (s.faiblesses.length === 0 && s.questionsRatees.length === 0 && s.progres.length === 0)) return "";
  const parties: string[] = [
    `Le jury a déjà entendu ce candidat ${s.nbAppels === 1 ? "une fois" : `${s.nbAppels} fois`}.`,
  ];
  if (s.questionsRatees.length > 0) {
    parties.push(
      "Questions restées sans bonne réponse au dernier appel :",
      ...s.questionsRatees.map((q) => `- « ${q.question} » — une bonne réponse contenait : ${q.attendu}`),
    );
  }
  if (s.faiblesses.length > 0) {
    parties.push(
      "Points encore faibles au dernier appel :",
      ...s.faiblesses.map((f) => `- ${f.critere} (${f.note}/10) : ${f.constat}`),
    );
  }
  if (s.progres.length > 0) {
    parties.push(
      "Progrès depuis l'appel précédent — à reconnaître si ça se confirme :",
      ...s.progres.map((p) => `- ${p.critere} : ${p.avant} → ${p.apres}`),
    );
  }
  return parties.join("\n").slice(0, LIMITES_SOUVENIRS.blocChars);
}
