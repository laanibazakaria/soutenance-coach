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
      .filter(isSessionRecord)
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

/** Supprime une session par id. Retourne la liste mise à jour. */
export function removeSession(storage: StorageLike, id: string): SessionRecord[] {
  const sessions = listSessions(storage).filter((s) => s.id !== id);
  storage.setItem(KEY, JSON.stringify(sessions));
  return sessions;
}

/** Compte les mots d'une transcription (séparateurs d'espaces, robuste au vide). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.startedAt === "string" &&
    typeof v.durationMs === "number" &&
    typeof v.transcript === "string" &&
    typeof v.wordCount === "number"
  );
}
