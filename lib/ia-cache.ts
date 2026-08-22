import type { StorageLike } from "./types";

/**
 * Cache local des résultats IA, indexé par une empreinte du support et des
 * paramètres. Évite de redemander (et de reconsommer du quota) pour le même
 * support — et permet à la simulation d'entretien de retrouver les questions
 * spécifiques sans refaire l'appel.
 */

/** Empreinte déterministe d'une chaîne (djb2), suffisante pour un cache local. */
export function empreinte(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const PREFIXE = "sc.ia.v1:";

export function lireCache<T>(storage: StorageLike, cle: string): T | null {
  const raw = storage.getItem(PREFIXE + cle);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function ecrireCache<T>(storage: StorageLike, cle: string, valeur: T): void {
  storage.setItem(PREFIXE + cle, JSON.stringify(valeur));
}

/** Clé stable pour un support + un usage + des paramètres. */
export function cleCache(usage: string, textesSlides: string[], params: string = ""): string {
  return `${usage}:${empreinte(textesSlides.join("") + "|" + params)}`;
}
