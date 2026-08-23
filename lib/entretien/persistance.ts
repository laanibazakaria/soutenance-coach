import type { StorageLike } from "../types";
import { estCandidature, type Candidature } from "./index";

export const CLE_CANDIDATURE = "sc.candidature.v1";

export function lireCandidature(storage: StorageLike): Candidature | null {
  const raw = storage.getItem(CLE_CANDIDATURE);
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return estCandidature(v) ? v : null;
  } catch {
    return null;
  }
}

export function sauverCandidature(storage: StorageLike, c: Candidature): void {
  storage.setItem(CLE_CANDIDATURE, JSON.stringify(c));
}

/** Coche ou décoche une étape du module. Idempotent. */
export function marquerEtapeEntretien(
  storage: StorageLike,
  id: string,
  faite: boolean,
  maintenant: string = new Date().toISOString(),
): Candidature | null {
  const c = lireCandidature(storage);
  if (!c) return null;
  if (Boolean(c.etapesFaites[id]) === faite) return c;
  const etapesFaites = { ...c.etapesFaites };
  if (faite) etapesFaites[id] = maintenant;
  else delete etapesFaites[id];
  const suivant = { ...c, etapesFaites, misAJourLe: maintenant };
  sauverCandidature(storage, suivant);
  return suivant;
}

/** Clé de cache des questions générées pour cette candidature. */
export function cleQuestionsEntretien(c: Pick<Candidature, "poste" | "offre" | "cvTexte">): string {
  let h = 5381;
  const s = `${c.poste}|${c.offre}|${c.cvTexte}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `entretien-questions:${(h >>> 0).toString(36)}`;
}
