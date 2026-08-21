/** Niveau d'une métrique. "absent" = pas assez de données pour un verdict fiable. */
export type MetricLevel = "bon" | "attention" | "alerte" | "absent";

export interface MetricResult {
  /** Identifiant stable de la métrique. */
  id: "debit" | "bequilles" | "phrases" | "structure";
  /** Libellé affichable. */
  label: string;
  /** Verdict — calculé par du code, jamais par un LLM. */
  level: MetricLevel;
  /** Valeur principale (ex. 142 pour un débit), absente si non calculable. */
  value?: number;
  /** Unité de la valeur principale (ex. "mots/min"). */
  unit?: string;
  /** Une phrase d'explication du verdict, toujours présente. */
  summary: string;
  /** Détails complémentaires (ex. top des mots béquilles). */
  details: string[];
}

export interface ScoreReport {
  /** Les métriques, dans un ordre stable d'affichage. */
  metrics: MetricResult[];
  /** Nombre de mots analysés. */
  wordCount: number;
}

export interface ScoringInput {
  transcript: string;
  durationMs: number;
}
