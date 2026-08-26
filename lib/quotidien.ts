/**
 * La question du jour et la série : cinq minutes par jour, dans le bus.
 * Le choix du jour est déterministe (même question toute la journée, sur
 * tous les appareils) ; la série compte les jours consécutifs sans
 * culpabiliser — rater un jour remet à zéro, rien de plus.
 */

import { joursEntre, ajouterJours } from "./parcours";

export interface CandidateQuestion {
  id: string;
  question: string;
  pourquoi: string;
  /** D'où elle vient : décide du jury qui évaluera. */
  source: "soutenance" | "entretien";
}

function empreinte(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** La question du jour : stable pour une date et un ensemble de candidates. */
export function questionDuJour(date: string, candidates: CandidateQuestion[]): CandidateQuestion | null {
  if (candidates.length === 0) return null;
  const ordre = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  return ordre[empreinte(date) % ordre.length];
}

export interface Serie {
  /** Jours (YYYY-MM-DD) où la question du jour a été faite. */
  jours: string[];
}

export function marquerJour(serie: Serie | null, date: string): Serie {
  const jours = new Set(serie?.jours ?? []);
  jours.add(date);
  return { jours: [...jours].sort() };
}

export interface EtatSerie {
  /** Jours consécutifs jusqu'à aujourd'hui (ou hier si aujourd'hui n'est pas encore fait). */
  courante: number;
  /** Aujourd'hui est fait. */
  aujourdhuiFait: boolean;
  total: number;
  record: number;
}

export function calculerSerie(serie: Serie | null, aujourdhui: string): EtatSerie {
  const jours = new Set(serie?.jours ?? []);
  const aujourdhuiFait = jours.has(aujourdhui);
  let courante = 0;
  let curseur = aujourdhuiFait ? aujourdhui : ajouterJours(aujourdhui, -1);
  while (jours.has(curseur)) {
    courante++;
    curseur = ajouterJours(curseur, -1);
  }
  // Record : la plus longue suite de jours consécutifs.
  const tries = [...jours].sort();
  let record = 0;
  let run = 0;
  for (let i = 0; i < tries.length; i++) {
    run = i > 0 && joursEntre(tries[i - 1], tries[i]) === 1 ? run + 1 : 1;
    record = Math.max(record, run);
  }
  return { courante, aujourdhuiFait, total: jours.size, record };
}

/** La phrase de la série — encourageante, jamais culpabilisante. */
export function phraseSerie(e: EtatSerie): string {
  if (e.total === 0) return "Première question du jour : une minute au micro, c'est tout.";
  if (e.aujourdhuiFait) return e.courante >= 2 ? `${e.courante} jours d'affilée — à demain.` : "Fait pour aujourd'hui — à demain.";
  if (e.courante >= 1) return `${e.courante} jour${e.courante > 1 ? "s" : ""} d'affilée. Une minute pour continuer.`;
  return e.record >= 2 ? `Ton record : ${e.record} jours. On reprend aujourd'hui ?` : "On reprend aujourd'hui ?";
}
