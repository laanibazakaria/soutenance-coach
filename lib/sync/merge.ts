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
