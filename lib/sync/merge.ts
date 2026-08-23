/**
 * Fusion entre les données locales (navigateur) et distantes (compte).
 * Fonctions pures, testées : la synchronisation ne doit jamais perdre une
 * session, ni en dupliquer une.
 */

import type { SessionRecord } from "../types";
import type { Deck } from "../slides/types";

/**
 * Union par identifiant. Une session est immuable une fois créée : deux
 * exemplaires du même id sont le même objet, on garde le premier vu.
 * Résultat trié de la plus récente à la plus ancienne.
 */
export function fusionnerSessions(
  locales: SessionRecord[],
  distantes: SessionRecord[],
): SessionRecord[] {
  const parId = new Map<string, SessionRecord>();
  for (const s of [...locales, ...distantes]) {
    if (!parId.has(s.id)) parId.set(s.id, s);
  }
  return [...parId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Les sessions présentes localement mais absentes du serveur : à pousser. */
export function sessionsAPousser(locales: SessionRecord[], distantes: SessionRecord[]): SessionRecord[] {
  const ids = new Set(distantes.map((s) => s.id));
  return locales.filter((s) => !ids.has(s.id));
}

/**
 * Support courant : le plus récemment modifié l'emporte. Sans horodatage
 * local (le navigateur n'en garde pas), on préfère le local quand il existe —
 * c'est celui que l'utilisateur vient de manipuler.
 */
export function fusionnerDeck(local: Deck | null, distant: Deck | null): Deck | null {
  return local ?? distant;
}

/**
 * Résultats IA : union des clés ; en cas de conflit le local gagne (il est
 * plus récent par construction — on ne regénère que depuis l'appareil actif).
 */
export function fusionnerIa(
  local: Record<string, unknown>,
  distant: Record<string, unknown>,
): Record<string, unknown> {
  return { ...distant, ...local };
}

/** Le sous-ensemble de Storage nécessaire pour effacer : localStorage le satisfait. */
export interface StorageEffacable {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** Clés locales appartenant au travail de l'utilisateur (pas les réglages). */
export const CLES_DONNEES = ["sc.sessions.v1", "sc.deck.v1", "sc.parcours.v1", "sc.candidature.v1", "sc.connecte"] as const;
export const PREFIXE_IA = "sc.ia.v1:";
export const PREFIXE_PROFIL = "sc.profil.v1:";

/**
 * Efface sessions, support, résultats IA et drapeau de connexion. À n'appeler
 * qu'après un envoi réussi au compte : sur un appareil partagé, la personne
 * suivante ne doit rien voir du travail de la précédente. Renvoie le nombre
 * de clés effacées.
 */
export function viderDonneesLocales(storage: StorageEffacable): number {
  const cles: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && ((CLES_DONNEES as readonly string[]).includes(k) || k.startsWith(PREFIXE_IA) || k.startsWith(PREFIXE_PROFIL))) cles.push(k);
  }
  for (const k of cles) storage.removeItem(k);
  return cles.length;
}
