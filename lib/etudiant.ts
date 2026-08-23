import type { StorageLike } from "./types";
import { lireCache, ecrireCache } from "./ia-cache";

/**
 * Le profil étudiant : qui prépare, où, à quel niveau. Trois champs, tous
 * facultatifs — mais ils nourrissent le jury IA (un jury d'école d'ingénieurs
 * ne parle pas comme un jury de médecine) et pré-remplissent les vraies
 * questions. Rangé dans le cache IA synchronisé, comme les préférences.
 */
export interface ProfilEtudiant {
  ecole: string;
  filiere: string;
  /** Licence, PFA, PFE, M2, doctorat… en toutes lettres. */
  niveau: string;
}

const CLE = "profil-etudiant";

export function lireProfilEtudiant(storage: StorageLike): ProfilEtudiant | null {
  const brut = lireCache<Partial<ProfilEtudiant>>(storage, CLE);
  if (!brut || typeof brut !== "object") return null;
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) : "");
  const p = { ecole: s(brut.ecole), filiere: s(brut.filiere), niveau: s(brut.niveau) };
  return p.ecole || p.filiere || p.niveau ? p : null;
}

export function sauverProfilEtudiant(storage: StorageLike, p: ProfilEtudiant): void {
  ecrireCache(storage, CLE, { ecole: p.ecole.trim().slice(0, 80), filiere: p.filiere.trim().slice(0, 80), niveau: p.niveau.trim().slice(0, 80) });
}

/** Une ligne de contexte pour le jury IA, ou null si le profil est vide. */
export function ligneContexteEtudiant(p: ProfilEtudiant | null): string | null {
  if (!p) return null;
  const morceaux = [p.niveau && `niveau : ${p.niveau}`, p.ecole && `établissement : ${p.ecole}`, p.filiere && `filière : ${p.filiere}`].filter(Boolean);
  return morceaux.length ? `Candidat — ${morceaux.join(" · ")}.` : null;
}
