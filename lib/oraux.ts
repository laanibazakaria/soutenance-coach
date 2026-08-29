import type { StorageLike } from "./types";
import { sauverModulesActifs } from "./preferences";

/**
 * Les oraux : des dossiers de travail NOMMÉS. Avant, la plateforme n'avait
 * qu'un seul espace — déposer un nouveau mémoire écrasait l'ancien, et
 * soutenance et entretien se marchaient dessus. Désormais chaque oral a un
 * nom, un type, et TOUT ce qui lui appartient : documents, appels, fiches,
 * sessions, mémoire du jury, progression.
 *
 * Mécanique : l'oral actif vit dans les clés habituelles (aucune page n'a
 * eu à changer) ; les autres dorment chacun dans une archive
 * `sc.oral.v1:<id>`. Basculer = geler l'espace courant dans son archive,
 * réveiller celle de la cible. Rien n'est perdu, rien ne fuit de l'un à
 * l'autre.
 */

export type TypeOral = "soutenance" | "entretien";

export interface Oral {
  id: string;
  nom: string;
  type: TypeOral;
  creeLe: string;
  vuLe: string;
}

const CLE_REGISTRE = "sc.oraux.v1";
const PREFIXE_ARCHIVE = "sc.oral.v1:";

/**
 * Ce qui appartient à UN oral. Tout le reste (langue, profil, bascule
 * dictée, notifications) est global à l'appareil et ne bouge pas.
 */
const PREFIXES_ESPACE = ["sc.deck.v1", "sc.candidature.v1", "sc.sessions.v1", "sc.parcours.v1", "sc.ia.v1:"];

interface Registre {
  actif: string | null;
  liste: Oral[];
}

type StorageEnumerable = StorageLike & { length: number; key(i: number): string | null; removeItem(cle: string): void };

function lireRegistre(storage: StorageLike): Registre {
  try {
    const brut = storage.getItem(CLE_REGISTRE);
    if (!brut) return { actif: null, liste: [] };
    const j = JSON.parse(brut) as Registre;
    if (!Array.isArray(j.liste)) return { actif: null, liste: [] };
    return { actif: typeof j.actif === "string" ? j.actif : null, liste: j.liste.filter((o) => o && typeof o.id === "string" && typeof o.nom === "string") };
  } catch {
    return { actif: null, liste: [] };
  }
}

function ecrireRegistre(storage: StorageLike, r: Registre): void {
  try {
    storage.setItem(CLE_REGISTRE, JSON.stringify(r));
  } catch {
    /* stockage plein ou indisponible : l'espace courant reste utilisable */
  }
}

export function listeOraux(storage: StorageLike): Oral[] {
  return [...lireRegistre(storage).liste].sort((a, b) => (a.vuLe < b.vuLe ? 1 : -1));
}

export function oralActif(storage: StorageLike): Oral | null {
  const r = lireRegistre(storage);
  return r.liste.find((o) => o.id === r.actif) ?? null;
}

/** Les clés de l'espace de travail courant, énumérées. */
function clesEspace(storage: StorageLike): string[] {
  const st = storage as StorageEnumerable;
  if (typeof st.length !== "number" || typeof st.key !== "function") return [];
  const cles: string[] = [];
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (k && PREFIXES_ESPACE.some((p) => k === p || k.startsWith(p))) cles.push(k);
  }
  return cles;
}

/** Gèle l'espace courant : le retire des clés vives, rend l'instantané. */
function geler(storage: StorageLike): Record<string, string> {
  const instantane: Record<string, string> = {};
  for (const k of clesEspace(storage)) {
    const v = storage.getItem(k);
    if (v !== null) instantane[k] = v;
    (storage as StorageEnumerable).removeItem(k);
  }
  return instantane;
}

function restaurer(storage: StorageLike, instantane: Record<string, string>): void {
  for (const [k, v] of Object.entries(instantane)) {
    try {
      storage.setItem(k, v);
    } catch {
      /* stockage plein : on restaure ce qu'on peut, le registre reste cohérent */
    }
  }
}

function archiver(storage: StorageLike, id: string): void {
  const instantane = geler(storage);
  try {
    storage.setItem(PREFIXE_ARCHIVE + id, JSON.stringify(instantane));
  } catch {
    // Trop gros pour l'archive : on remet l'espace en place plutôt que de le perdre.
    restaurer(storage, instantane);
    throw new Error("archive impossible (stockage plein)");
  }
}

function reveiller(storage: StorageLike, id: string): void {
  try {
    const brut = storage.getItem(PREFIXE_ARCHIVE + id);
    if (brut) restaurer(storage, JSON.parse(brut) as Record<string, string>);
  } catch {
    /* archive illisible : l'oral repart d'un espace vide */
  }
  (storage as StorageEnumerable).removeItem(PREFIXE_ARCHIVE + id);
}

function horodatage(): string {
  return new Date().toISOString();
}

/**
 * Crée un oral et le rend actif : l'espace courant est archivé chez l'oral
 * qui le possédait, le nouveau démarre vierge, typé (la préférence de
 * module suit, tout le reste de l'app s'aligne dessus).
 */
export function creerOral(storage: StorageLike, nom: string, type: TypeOral): Oral {
  const r = lireRegistre(storage);
  if (r.actif) archiver(storage, r.actif);
  else geler(storage); // des restes sans propriétaire : un espace neuf part propre
  const oral: Oral = { id: crypto.randomUUID(), nom: nom.trim().slice(0, 60) || "Sans nom", type, creeLe: horodatage(), vuLe: horodatage() };
  ecrireRegistre(storage, { actif: oral.id, liste: [...r.liste, oral] });
  sauverModulesActifs(storage, [type]);
  return oral;
}

/** Bascule sur un autre oral : gèle le courant, réveille la cible. */
export function basculerSurOral(storage: StorageLike, id: string): boolean {
  const r = lireRegistre(storage);
  const cible = r.liste.find((o) => o.id === id);
  if (!cible || r.actif === id) return false;
  if (r.actif) archiver(storage, r.actif);
  else geler(storage);
  reveiller(storage, id);
  cible.vuLe = horodatage();
  ecrireRegistre(storage, { actif: id, liste: r.liste });
  return true;
}

export function renommerOral(storage: StorageLike, id: string, nom: string): void {
  const r = lireRegistre(storage);
  const oral = r.liste.find((o) => o.id === id);
  if (!oral) return;
  oral.nom = nom.trim().slice(0, 60) || oral.nom;
  ecrireRegistre(storage, r);
}

/** Supprime un oral et tout ce qu'il contient — définitif. */
export function supprimerOral(storage: StorageLike, id: string): void {
  const r = lireRegistre(storage);
  if (!r.liste.some((o) => o.id === id)) return;
  const liste = r.liste.filter((o) => o.id !== id);
  if (r.actif === id) {
    geler(storage); // jeté, pas archivé : c'est une suppression
    const suivant = [...liste].sort((a, b) => (a.vuLe < b.vuLe ? 1 : -1))[0] ?? null;
    if (suivant) reveiller(storage, suivant.id);
    ecrireRegistre(storage, { actif: suivant?.id ?? null, liste });
  } else {
    (storage as StorageEnumerable).removeItem(PREFIXE_ARCHIVE + id);
    ecrireRegistre(storage, { actif: r.actif, liste });
  }
}

/** Devine le type d'un espace d'avant les oraux, d'après ce qu'il contient. */
export function typeDevine(storage: StorageLike): TypeOral {
  const deck = storage.getItem("sc.deck.v1");
  const rapport = storage.getItem("sc.ia.v1:rapport:texte");
  if (deck || rapport) return "soutenance";
  return storage.getItem("sc.candidature.v1") ? "entretien" : "soutenance";
}

/**
 * Migration : un appareil d'avant les oraux a du travail sans dossier. On
 * l'adopte tel quel comme premier oral (rien n'est gelé : il est déjà en
 * place), nommé d'après son type — renommable ensuite.
 */
export function adopterEspaceExistant(storage: StorageLike): Oral | null {
  const r = lireRegistre(storage);
  if (r.liste.length > 0) return null;
  if (clesEspace(storage).length === 0) return null;
  const type = typeDevine(storage);
  const oral: Oral = { id: crypto.randomUUID(), nom: type === "soutenance" ? "Ma soutenance" : "Mon entretien", type, creeLe: horodatage(), vuLe: horodatage() };
  ecrireRegistre(storage, { actif: oral.id, liste: [oral] });
  return oral;
}
