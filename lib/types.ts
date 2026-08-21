/** Une session d'entraînement oral, telle que persistée localement. */
export interface SessionRecord {
  /** Identifiant unique (généré côté client). */
  id: string;
  /** Début de session, ISO 8601. */
  startedAt: string;
  /** Durée effective d'enregistrement, en millisecondes. */
  durationMs: number;
  /** Transcription complète (segments finalisés uniquement). */
  transcript: string;
  /** Nombre de mots de la transcription (calculé à la sauvegarde). */
  wordCount: number;
}

/**
 * Interface minimale de stockage — permet d'injecter un stockage en mémoire
 * dans les tests, sans dépendre du DOM ni de localStorage.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
