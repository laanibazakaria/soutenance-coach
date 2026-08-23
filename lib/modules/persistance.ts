import type { StorageLike } from "../types";
import { estProfilModule, type ModuleId, type ProfilModule } from "./index";

export const PREFIXE_PROFIL = "sc.profil.v1:";

export function cleProfil(module: ModuleId): string {
  return PREFIXE_PROFIL + module;
}

export function lireProfil(storage: StorageLike, module: ModuleId): ProfilModule | null {
  const raw = storage.getItem(cleProfil(module));
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return estProfilModule(v) && v.module === module ? v : null;
  } catch {
    return null;
  }
}

export function sauverProfil(storage: StorageLike, p: ProfilModule): void {
  storage.setItem(cleProfil(p.module), JSON.stringify(p));
}

export function marquerEtapeModule(
  storage: StorageLike,
  module: ModuleId,
  id: string,
  faite: boolean,
  maintenant: string = new Date().toISOString(),
): ProfilModule | null {
  const p = lireProfil(storage, module);
  if (!p) return null;
  if (Boolean(p.etapesFaites[id]) === faite) return p;
  const etapesFaites = { ...p.etapesFaites };
  if (faite) etapesFaites[id] = maintenant;
  else delete etapesFaites[id];
  const suivant = { ...p, etapesFaites, misAJourLe: maintenant };
  sauverProfil(storage, suivant);
  return suivant;
}

/** Clé de cache des questions générées : dépend du contenu du profil. */
export function cleQuestionsModule(p: Pick<ProfilModule, "module" | "champs" | "documentTexte">): string {
  let h = 5381;
  const s = `${p.module}|${JSON.stringify(p.champs)}|${p.documentTexte}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `module-questions:${p.module}:${(h >>> 0).toString(36)}`;
}
