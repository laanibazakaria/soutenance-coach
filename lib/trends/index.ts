/**
 * La mémoire du coach : détection de tendances entre sessions.
 *
 * Principe hérité de la fiche de mission (et de la mission 7 du stage qui l'a
 * inspirée) : le calcul de tendance est déterministe et testé — en dessous de
 * `minSessions` points, on ne déclare RIEN. Déclarer une tendance sur deux
 * points, c'est sur-interpréter du bruit. Pas de détection molle.
 *
 * Méthode : chaque métrique est convertie en « pénalité » normalisée sur 100
 * (0 = parfait). La tendance compare la moyenne de la première moitié de la
 * fenêtre à celle de la seconde — choix documenté dans MISSION.md : simple et
 * explicable. Limite assumée : un pic isolé en début ou fin de fenêtre pèse
 * sur sa moitié (seul un pic central s'annule) ; si l'usage réel le rend
 * gênant, la médiane par moitié est l'évolution prévue.
 */

import { computeReport } from "../scoring";
import type { MetricResult, ScoreReport } from "../scoring";
import type { SessionRecord } from "../types";

export const SEUILS_TENDANCES = {
  /** En dessous de ce nombre de sessions mesurables : aucune tendance. Non négociable. */
  minSessions: 3,
  /** Fenêtre d'analyse : les N dernières sessions mesurables. */
  fenetre: 6,
  /** Variation de pénalité (sur 100) en dessous de laquelle on déclare une stagnation. */
  stagnationDelta: 8,
  /** Plafonds de normalisation des pénalités (100 = ce plafond est atteint). */
  plafonds: { debit: 60, bequilles: 15, phrases: 15, structure: 2 },
} as const;

export type TrendDirection = "progression" | "stagnation" | "regression" | "absent";

export interface TrendResult {
  id: MetricResult["id"];
  label: string;
  trend: TrendDirection;
  /** Nombre de sessions réellement mesurables pour cette métrique. */
  sessionsCount: number;
  /** Valeur brute de la métrique, première et dernière session mesurable de la fenêtre. */
  firstValue?: number | string;
  lastValue?: number | string;
  /** Phrase d'insight, calculée à partir des chiffres — jamais par un LLM. */
  insight: string;
}

/* ── pénalités par métrique (0 = parfait, plafonnées puis normalisées /100) ── */

/** Distance à l'intervalle de confort du débit (en mots/min). */
function penaliteDebit(wpm: number): number {
  const { bonMin, bonMax } = { bonMin: 110, bonMax: 160 };
  const distance = wpm < bonMin ? bonMin - wpm : wpm > bonMax ? wpm - bonMax : 0;
  return normalise(distance, SEUILS_TENDANCES.plafonds.debit);
}

/** Les béquilles pénalisent dès la première (valeur = béquilles pour 100 mots). */
function penaliteBequilles(per100: number): number {
  return normalise(per100, SEUILS_TENDANCES.plafonds.bequilles);
}

/** Au-delà de 22 mots de moyenne, chaque mot pénalise. */
function penalitePhrases(moyenne: number): number {
  return normalise(Math.max(0, moyenne - 22), SEUILS_TENDANCES.plafonds.phrases);
}

/** Structure : bon = 0, attention = 1, alerte = 2 (sur un plafond de 2). */
function penaliteStructure(level: MetricResult["level"]): number {
  const score = level === "bon" ? 0 : level === "attention" ? 1 : 2;
  return normalise(score, SEUILS_TENDANCES.plafonds.structure);
}

function normalise(valeur: number, plafond: number): number {
  return Math.min(100, Math.round((valeur / plafond) * 100));
}

/* ── extraction des points mesurables d'une session ── */

interface PointMesure {
  penalite: number;
  brut: number | string;
}

/** Extrait le point mesurable d'une métrique, ou null si elle est absente. */
function pointDe(report: ScoreReport, id: MetricResult["id"]): PointMesure | null {
  const m = report.metrics.find((x) => x.id === id);
  if (!m || m.level === "absent") return null;
  switch (id) {
    case "debit":
      return m.value === undefined ? null : { penalite: penaliteDebit(m.value), brut: m.value };
    case "bequilles":
      return m.value === undefined ? null : { penalite: penaliteBequilles(m.value), brut: m.value };
    case "phrases":
      return m.value === undefined ? null : { penalite: penalitePhrases(m.value), brut: m.value };
    case "structure":
      return { penalite: penaliteStructure(m.level), brut: m.level };
  }
}

/* ── cœur : tendance sur une série de pénalités ── */

/**
 * Compare la moyenne de la première moitié à celle de la seconde.
 * Exportée pour être testée directement.
 */
export function detectTrend(penalites: number[]): Exclude<TrendDirection, "absent"> | "absent" {
  if (penalites.length < SEUILS_TENDANCES.minSessions) return "absent";
  const moitie = Math.floor(penalites.length / 2);
  // Avec un nombre impair de points, le point central compte dans les deux
  // moitiés — chaque moitié garde ainsi le même poids.
  const premiere = penalites.slice(0, Math.ceil(penalites.length / 2));
  const seconde = penalites.slice(moitie);
  const delta = moyenne(seconde) - moyenne(premiere);
  if (Math.abs(delta) < SEUILS_TENDANCES.stagnationDelta) return "stagnation";
  return delta < 0 ? "progression" : "regression";
}

function moyenne(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/* ── rapport complet ── */

const LABELS: Record<MetricResult["id"], string> = {
  debit: "Débit de parole",
  bequilles: "Mots béquilles",
  phrases: "Longueur des phrases",
  structure: "Structure annoncée",
};

/**
 * Construit le rapport de tendances à partir des sessions (ordre quelconque —
 * elles sont retriées chronologiquement). Fonction pure, jamais d'exception.
 */
export function buildTrendReport(sessions: SessionRecord[]): TrendResult[] {
  const chrono = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const reports = chrono.map((s) =>
    computeReport({
      transcript: s.transcript,
      durationMs: s.durationMs,
      confidence: s.confidence,
    }),
  );

  return (Object.keys(LABELS) as MetricResult["id"][]).map((id) => {
    const points = reports
      .map((r) => pointDe(r, id))
      .filter((p): p is PointMesure => p !== null)
      .slice(-SEUILS_TENDANCES.fenetre);

    const base = { id, label: LABELS[id], sessionsCount: points.length };
    if (points.length < SEUILS_TENDANCES.minSessions) {
      const manque = SEUILS_TENDANCES.minSessions - points.length;
      return {
        ...base,
        trend: "absent" as const,
        insight: `Encore ${manque} session${manque > 1 ? "s" : ""} mesurable${manque > 1 ? "s" : ""} pour débloquer cette tendance.`,
      };
    }

    const trend = detectTrend(points.map((p) => p.penalite));
    const first = points[0].brut;
    const last = points[points.length - 1].brut;
    return {
      ...base,
      trend: trend as TrendDirection,
      firstValue: first,
      lastValue: last,
      insight: phrase(id, trend as Exclude<TrendDirection, "absent">, first, last, points),
    };
  });
}

/** Formule l'insight à partir des chiffres établis — le LLM n'intervient jamais ici. */
function phrase(
  id: MetricResult["id"],
  trend: Exclude<TrendDirection, "absent">,
  first: number | string,
  last: number | string,
  points: PointMesure[],
): string {
  const evolution =
    id === "structure" ? `${String(first)} → ${String(last)}` : `${first} → ${last}`;
  const unites: Record<string, string> = {
    debit: "mots/min",
    bequilles: "béquilles pour 100 mots",
    phrases: "mots/phrase",
    structure: "",
  };
  const u = unites[id] ? ` ${unites[id]}` : "";

  if (trend === "progression") return `En progression : ${evolution}${u} sur ${points.length} sessions. Continue.`;
  if (trend === "regression") return `En recul : ${evolution}${u}. Reprends ce point à ta prochaine session.`;
  // Stagnation : le ton dépend du niveau — stagner au bon niveau est une réussite.
  const dernierePenalite = points[points.length - 1].penalite;
  return dernierePenalite === 0
    ? `Stable au bon niveau (${String(last)}${u}) depuis ${points.length} sessions — c'est acquis.`
    : `Stagne (${evolution}${u}) depuis ${points.length} sessions — c'est TON point de travail prioritaire.`;
}
