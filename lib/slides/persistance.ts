import type { Deck, Slide } from "./types";
import type { StorageLike } from "../types";

/**
 * Mémorise le dernier support analysé, pour que la simulation d'entretien
 * s'appuie dessus sans redemander le fichier. Seul le texte extrait est
 * conservé — jamais le PDF lui-même.
 */

const KEY = "sc.deck.v1";

export function sauverDeck(storage: StorageLike, deck: Deck): void {
  storage.setItem(KEY, JSON.stringify(deck));
}

/** Relit le support mémorisé. Renvoie null si absent ou corrompu. */
export function listeDeckSauvegarde(storage: StorageLike): Deck | null {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.nomFichier !== "string" || !Array.isArray(o.slides)) return null;
    const slides = o.slides.filter(estSlide);
    return slides.length > 0 ? { nomFichier: o.nomFichier, slides } : null;
  } catch {
    return null;
  }
}

export function oublierDeck(storage: StorageLike): void {
  storage.setItem(KEY, "");
}

function estSlide(value: unknown): value is Slide {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.numero === "number" &&
    typeof v.titre === "string" &&
    typeof v.texte === "string" &&
    typeof v.motsCount === "number"
  );
}
