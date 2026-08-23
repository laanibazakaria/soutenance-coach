import type { StorageLike, SessionRecord } from "../types";
import { listeDeckSauvegarde } from "../slides/persistance";
import { estParcours, type Parcours, type Contexte } from "./index";

export const CLE_PARCOURS = "sc.parcours.v1";

export function lireParcours(storage: StorageLike): Parcours | null {
  const raw = storage.getItem(CLE_PARCOURS);
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return estParcours(v) ? v : null;
  } catch {
    return null;
  }
}

export function sauverParcours(storage: StorageLike, p: Parcours): void {
  storage.setItem(CLE_PARCOURS, JSON.stringify(p));
}

/** Sans removeItem dans StorageLike : une valeur vide vaut « absent ». */
export function oublierParcours(storage: StorageLike): void {
  storage.setItem(CLE_PARCOURS, "");
}

/**
 * Coche (ou décoche) une étape. Idempotent : marquer une étape déjà faite
 * ne change ni sa date ni `misAJourLe`. Renvoie le parcours, ou null s'il
 * n'y en a pas — les pages appellent ceci sans savoir si un parcours existe.
 */
export function marquerEtape(
  storage: StorageLike,
  id: string,
  faite: boolean,
  maintenant: string = new Date().toISOString(),
): Parcours | null {
  const p = lireParcours(storage);
  if (!p) return null;
  const deja = Boolean(p.etapesFaites[id]);
  if (deja === faite) return p;
  const etapesFaites = { ...p.etapesFaites };
  if (faite) etapesFaites[id] = maintenant;
  else delete etapesFaites[id];
  const suivant = { ...p, etapesFaites, misAJourLe: maintenant };
  sauverParcours(storage, suivant);
  return suivant;
}

/** Le sous-ensemble de Storage qui sait énumérer ses clés (localStorage le satisfait). */
export interface StorageEnumerable extends StorageLike {
  readonly length: number;
  key(index: number): string | null;
}

/** Lit dans le stockage ce qui prouve l'activité : support, pitch, questions. */
export function detecterContexte(storage: StorageEnumerable, sessions: SessionRecord[]): Contexte {
  let pitchGenere = false;
  let questionsGenerees = false;
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i) ?? "";
    if (k.startsWith("sc.ia.v1:pitch:")) pitchGenere = true;
    if (k.startsWith("sc.ia.v1:questions")) questionsGenerees = true;
  }
  return { sessions, deckPresent: listeDeckSauvegarde(storage) !== null, pitchGenere, questionsGenerees };
}
