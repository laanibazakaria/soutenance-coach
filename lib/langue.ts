/**
 * La langue de l'oral : la reconnaissance vocale du navigateur et les
 * réponses des jurys IA la suivent. Préférence locale (un appareil, une
 * langue d'entraînement) ; le français reste le défaut.
 */

import type { StorageLike } from "./types";

export type Langue = "fr-FR" | "en-US";
export type LangueCourte = "fr" | "en";

const CLE = "sc.langue.v1";

export const LANGUES: ReadonlyArray<{ id: Langue; label: string; courte: LangueCourte }> = [
  { id: "fr-FR", label: "Français", courte: "fr" },
  { id: "en-US", label: "English", courte: "en" },
];

export function lireLangue(storage: StorageLike): Langue {
  return storage.getItem(CLE) === "en-US" ? "en-US" : "fr-FR";
}

export function sauverLangue(storage: StorageLike, langue: Langue): void {
  storage.setItem(CLE, langue);
}

export function courte(langue: Langue): LangueCourte {
  return langue === "en-US" ? "en" : "fr";
}

/** La consigne ajoutée aux prompts quand l'oral se passe en anglais. */
export function consigneLangue(langue?: LangueCourte | null): string {
  return langue === "en"
    ? "\n- LANGUE : le candidat passe cet oral EN ANGLAIS. Rédige tout le JSON en anglais (valeurs), avec le même ton (tutoiement → « you »)."
    : "";
}
