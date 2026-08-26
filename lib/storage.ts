import type { SessionRecord, StorageLike } from "./types";

/**
 * Persistance des sessions — fonctions pures sur une interface StorageLike.
 * Aucune donnée ne quitte le navigateur : c'est un garde-fou de la fiche de
 * mission, pas un détail d'implémentation.
 */

const KEY = "sc.sessions.v1";

/** Liste les sessions, la plus récente en premier. Tolère un stockage corrompu. */
export function listSessions(storage: StorageLike): SessionRecord[] {
  const raw = storage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(estSessionRecord)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch {
    return [];
  }
}

/** Ajoute une session. Retourne la liste mise à jour (plus récente en premier). */
export function saveSession(storage: StorageLike, session: SessionRecord): SessionRecord[] {
  const sessions = listSessions(storage).filter((s) => s.id !== session.id);
  sessions.push(session);
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  storage.setItem(KEY, JSON.stringify(sessions));
  return sessions;
}

/** Remplace toute la liste (fusion après synchronisation). */
export function remplacerSessions(storage: StorageLike, sessions: SessionRecord[]): SessionRecord[] {
  const triees = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  storage.setItem(KEY, JSON.stringify(triees));
  return triees;
}

/** Supprime une session par id. Retourne la liste mise à jour. */
export function removeSession(storage: StorageLike, id: string): SessionRecord[] {
  const sessions = listSessions(storage).filter((s) => s.id !== id);
  storage.setItem(KEY, JSON.stringify(sessions));
  return sessions;
}

/* ── export / import ──────────────────────────────────────────────────────
   Les données vivent dans le navigateur : sans export, un vidage du cache les
   perd. Le format est un JSON lisible, versionné, réimportable ailleurs. */

export interface ExportBundle {
  format: "soutenance-coach/sessions";
  version: 1;
  exportedAt: string;
  sessions: SessionRecord[];
}

/** Sérialise les sessions pour un fichier téléchargeable. */
export function exportSessions(sessions: SessionRecord[], exportedAt: string): string {
  const bundle: ExportBundle = {
    format: "soutenance-coach/sessions",
    version: 1,
    exportedAt,
    sessions,
  };
  return JSON.stringify(bundle, null, 2);
}

export interface ImportOutcome {
  /** Sessions ajoutées (celles dont l'id n'existait pas déjà). */
  added: number;
  /** Sessions ignorées car déjà présentes. */
  skipped: number;
  /** Entrées rejetées car mal formées. */
  invalid: number;
  /** Message d'erreur si le fichier entier est inexploitable. */
  error?: string;
}

/**
 * Fusionne un export dans le stockage : les sessions déjà présentes (même id)
 * ne sont jamais écrasées — un import ne détruit rien.
 */
export function importSessions(storage: StorageLike, raw: string): ImportOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { added: 0, skipped: 0, invalid: 0, error: "Fichier illisible : ce n'est pas du JSON." };
  }
  const candidates = extractSessions(parsed);
  if (candidates === null) {
    return {
      added: 0,
      skipped: 0,
      invalid: 0,
      error: "Format non reconnu : attendu un export SoutenanceCoach.",
    };
  }

  const existing = listSessions(storage);
  const knownIds = new Set(existing.map((s) => s.id));
  let added = 0;
  let skipped = 0;
  let invalid = 0;
  const merged = [...existing];

  for (const candidate of candidates) {
    if (!estSessionRecord(candidate)) {
      invalid++;
      continue;
    }
    if (knownIds.has(candidate.id)) {
      skipped++;
      continue;
    }
    knownIds.add(candidate.id);
    merged.push(candidate);
    added++;
  }

  merged.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  storage.setItem(KEY, JSON.stringify(merged));
  return { added, skipped, invalid };
}

/** Accepte l'enveloppe versionnée ou un simple tableau de sessions. */
function extractSessions(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    const bundle = parsed as Record<string, unknown>;
    if (Array.isArray(bundle.sessions)) return bundle.sessions;
  }
  return null;
}

/** Compte les mots d'une transcription (séparateurs d'espaces, robuste au vide). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** Validation d'une session — partagée avec la synchronisation serveur. */
export function estSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.startedAt === "string" &&
    typeof v.durationMs === "number" &&
    typeof v.transcript === "string" &&
    typeof v.wordCount === "number" &&
    (v.confidence === undefined || typeof v.confidence === "number") &&
    (v.targetDurationMs === undefined || typeof v.targetDurationMs === "number") &&
    (v.mode === undefined || v.mode === "soutenance" || v.mode === "entretien") &&
    (v.audio === undefined || (typeof v.audio === "object" && v.audio !== null && typeof (v.audio as { pausesLongues?: unknown }).pausesLongues === "number")) &&
    (v.slides === undefined ||
      (Array.isArray(v.slides) &&
        v.slides.every(
          (s) => typeof s === "object" && s !== null && typeof (s as { numero?: unknown }).numero === "number" && typeof (s as { dureeMs?: unknown }).dureeMs === "number",
        )))
  );
}
