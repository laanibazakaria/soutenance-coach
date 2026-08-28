/**
 * Tout revoir : l'historique rangé pour la révision.
 *
 * L'historique existait — chaque appel garde son dialogue, son débrief, sa
 * grille — mais rangé par séance. Or la veille d'un oral, on ne relit pas des
 * séances : on relit des QUESTIONS. Celles qu'on a ratées, avec ce qu'une
 * bonne réponse contenait ; celles qu'on a réussies, pour l'assurance ; et
 * toutes les autres, parce que le jury pioche toujours dans les mêmes eaux.
 *
 * Aucun appel IA : tout vient de ce qui est déjà stocké et déjà payé.
 */

import type { StorageLike } from "./types";
import type { Debrief, Message, ModeAppel } from "./appel";

export interface QuestionRevue {
  question: string;
  mode: ModeAppel;
  /** Date de la dernière fois où elle est apparue. */
  date: string;
  /** Ce que tu avais répondu, quand on l'a gardé. */
  tuAsDit?: string;
  /** Ce qu'une bonne réponse contenait — la matière de révision. */
  mieux?: string;
}

export interface Revision {
  /** Ratées, avec la bonne réponse : à relire en premier, et en boucle. */
  aRetravailler: QuestionRevue[];
  /** Ce que le jury a validé — l'assurance qu'on emporte. */
  solides: QuestionRevue[];
  /** Toutes les autres questions déjà posées, sans verdict gardé. */
  posees: QuestionRevue[];
  nbSeances: number;
}

/**
 * Deux formulations de la même question se rangent ensemble. La clé n'est PAS
 * tronquée court : un préfixe (« Alors, Zakaria : … ») décale tout, et deux
 * clés tronquées d'une question longue ne se contiendraient plus l'une
 * l'autre — c'est arrivé sur un historique réel.
 */
function cleQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 400);
}

interface AppelStocke {
  mode?: string;
  date?: string;
  dialogue?: Message[];
  debrief?: Debrief | null;
}

interface BlancheStockee {
  faitLe?: string;
  reponses?: Array<{ question?: { question?: string }; transcript?: string }>;
}

const estMode = (m: unknown): m is ModeAppel => m === "soutenance" || m === "entretien";

/** Construit la révision depuis tout ce que l'appareil a retenu. */
export function construireRevision(storage: StorageLike): Revision {
  const st = storage as unknown as { length?: number; key?: (i: number) => string | null };
  const vide: Revision = { aRetravailler: [], solides: [], posees: [], nbSeances: 0 };
  if (typeof st.length !== "number" || typeof st.key !== "function") return vide;

  // Une entrée par question ; la priorité fait foi : ratée > solide > posée.
  const rang = { aRetravailler: 3, solides: 2, posees: 1 } as const;
  const entrees = new Map<string, { statut: keyof typeof rang; q: QuestionRevue }>();
  let nbSeances = 0;

  const poser = (statut: keyof typeof rang, q: QuestionRevue) => {
    if (!q.question || q.question.trim().length < 8) return;
    const cle = cleQuestion(q.question);
    // Vu sur un historique réel : le jury préfixe parfois sa question
    // (« Alors, Zakaria : … ») — deux clés dont l'une contient l'autre
    // désignent la même question. Trente signes de garde contre les
    // rapprochements accidentels.
    let cible = cle;
    if (!entrees.has(cle) && cle.length >= 30) {
      for (const k of entrees.keys()) {
        if (k.length >= 30 && (k.includes(cle) || cle.includes(k))) {
          cible = k;
          break;
        }
      }
    }
    const existante = entrees.get(cible);
    if (existante && rang[existante.statut] > rang[statut]) return;
    if (existante && rang[existante.statut] === rang[statut] && existante.q.date > q.date) return;
    entrees.set(cible, { statut, q });
  };

  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (!k) continue;
    try {
      if (k.startsWith("sc.ia.v1:appel:") && !k.startsWith("sc.ia.v1:appel:questions-posees")) {
        const a = JSON.parse(storage.getItem(k) ?? "null") as AppelStocke | null;
        if (!a || !estMode(a.mode) || typeof a.date !== "string") continue;
        nbSeances++;
        const base = { mode: a.mode, date: a.date };
        for (const m of a.debrief?.momentsManques ?? []) {
          poser("aRetravailler", { ...base, question: m.question ?? "", tuAsDit: m.ceQueTuAsDit || undefined, mieux: m.mieux || undefined });
        }
        for (const b of a.debrief?.bienFait ?? []) {
          poser("solides", { ...base, question: b.point ?? "", tuAsDit: b.citation || undefined, mieux: b.pourquoi || undefined });
        }
        for (const m of a.dialogue ?? []) {
          if (m.role === "assistant" && m.content) poser("posees", { ...base, question: m.content });
        }
      }
      if (k.startsWith("sc.ia.v1:blanche:")) {
        const b = JSON.parse(storage.getItem(k) ?? "null") as BlancheStockee | null;
        if (!b || typeof b.faitLe !== "string") continue;
        nbSeances++;
        for (const r of b.reponses ?? []) {
          poser("posees", { mode: "soutenance", date: b.faitLe, question: r.question?.question ?? "", tuAsDit: r.transcript || undefined });
        }
      }
    } catch {
      // Une entrée illisible n'efface pas la révision.
    }
  }

  const parDate = (a: QuestionRevue, b: QuestionRevue) => (a.date > b.date ? -1 : 1);
  const revision: Revision = { aRetravailler: [], solides: [], posees: [], nbSeances };
  for (const { statut, q } of entrees.values()) revision[statut].push(q);
  revision.aRetravailler.sort(parDate);
  revision.solides.sort(parDate);
  revision.posees.sort(parDate);
  return revision;
}
