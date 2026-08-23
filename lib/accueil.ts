import type { SessionRecord } from "./types";
import type { Serie } from "./quotidien";
import { calculerSerie } from "./quotidien";

/**
 * Les chiffres de l'accueil : ce qu'on a fait cette semaine, et la tendance
 * par rapport à la semaine d'avant. Des comptages, jamais une note.
 */
export interface ChiffresSemaine {
  sessions: number;
  sessionsSemainePrecedente: number;
  minutes: number;
  mots: number;
  /** Jours d'affilée de question du jour. */
  serie: number;
  /** Sessions depuis le début du mois. */
  sessionsMois: number;
}

export function chiffresSemaine(sessions: SessionRecord[], serie: Serie | null, maintenant: Date = new Date()): ChiffresSemaine {
  const jour = 86_400_000;
  const t = maintenant.getTime();
  const depuis7 = t - 7 * jour;
  const depuis14 = t - 14 * jour;
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).getTime();
  const dans = (s: SessionRecord, a: number, b: number) => {
    const d = new Date(s.startedAt).getTime();
    return d >= a && d < b;
  };
  const cette = sessions.filter((s) => dans(s, depuis7, t + jour));
  const avant = sessions.filter((s) => dans(s, depuis14, depuis7));
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  return {
    sessions: cette.length,
    sessionsSemainePrecedente: avant.length,
    minutes: Math.round(cette.reduce((n, s) => n + s.durationMs, 0) / 60_000),
    mots: cette.reduce((n, s) => n + s.wordCount, 0),
    serie: calculerSerie(serie, aujourdhui).courante,
    sessionsMois: sessions.filter((s) => new Date(s.startedAt).getTime() >= debutMois).length,
  };
}

/** « samedi 23 août » — la date sous le bonjour. */
export function dateLongue(maintenant: Date = new Date()): string {
  const d = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** Le bonjour selon l'heure : on ne dit pas bonjour à 23 h. */
export function salutation(maintenant: Date = new Date()): string {
  const h = maintenant.getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

/** Débit d'une session en mots par minute, ou null si trop courte pour dire quoi que ce soit. */
export function debit(s: SessionRecord): number | null {
  if (s.durationMs < 20_000 || s.wordCount < 10) return null;
  return Math.round(s.wordCount / (s.durationMs / 60_000));
}
