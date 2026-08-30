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

/** L'instantané de l'espace vif, SANS le vider (pour la synchronisation). */
export function instantaneEspace(storage: StorageLike): Record<string, string> {
  const instantane: Record<string, string> = {};
  for (const k of clesEspace(storage)) {
    const v = storage.getItem(k);
    if (v !== null) instantane[k] = v;
  }
  return instantane;
}

/** L'archive d'un oral endormi, brute (null si absente). */
export function archiveBrute(storage: StorageLike, id: string): string | null {
  return storage.getItem(PREFIXE_ARCHIVE + id);
}

/**
 * Fusionne le monde des oraux venu du compte dans celui de l'appareil.
 * Règles volontairement simples (v1) :
 * - un oral inconnu ici arrive avec son archive ;
 * - un oral connu des deux : le plus récemment VU gagne (nom, type) ; son
 *   archive distante ne remplace la locale que s'il est plus récent ET
 *   endormi ici — l'oral ACTIF de cet appareil reste toujours la vérité ;
 * - deux orals de même nom et type mais d'identifiants différents (chaque
 *   appareil a migré de son côté) : on garde le plus récemment vu, l'autre
 *   est écarté — mieux qu'un historique en double.
 */
export function fusionnerMondeOraux(storage: StorageLike, distantRegistre: unknown, distantArchives: Record<string, string>): void {
  let distant: Registre;
  try {
    const j = typeof distantRegistre === "string" ? (JSON.parse(distantRegistre) as Registre) : (distantRegistre as Registre);
    if (!j || !Array.isArray(j.liste)) return;
    distant = j;
  } catch {
    return;
  }
  const local = lireRegistre(storage);
  const parId = new Map<string, Oral>(local.liste.map((o) => [o.id, o]));

  for (const d of distant.liste) {
    if (!d || typeof d.id !== "string") continue;
    const connu = parId.get(d.id);
    if (!connu) {
      // Même nom et type sous un autre identifiant : doublon de migration.
      const jumeau = [...parId.values()].find((o) => o.nom === d.nom && o.type === d.type);
      if (jumeau) {
        if (d.vuLe > jumeau.vuLe && jumeau.id !== local.actif) {
          parId.delete(jumeau.id);
          (storage as StorageEnumerable).removeItem(PREFIXE_ARCHIVE + jumeau.id);
          parId.set(d.id, { ...d });
          const arch = distantArchives[d.id];
          if (arch) storage.setItem(PREFIXE_ARCHIVE + d.id, arch);
        }
        continue;
      }
      parId.set(d.id, { ...d });
      const arch = distantArchives[d.id];
      if (arch) storage.setItem(PREFIXE_ARCHIVE + d.id, arch);
      continue;
    }
    if (d.vuLe > connu.vuLe) {
      connu.nom = d.nom;
      connu.vuLe = d.vuLe;
      if (connu.id !== local.actif) {
        const arch = distantArchives[d.id];
        if (arch) storage.setItem(PREFIXE_ARCHIVE + d.id, arch);
      }
    }
  }
  ecrireRegistre(storage, { actif: local.actif, liste: [...parId.values()] });
}

/**
 * Réparation : les appareils passés par la PREMIÈRE adoption (avant le
 * découpage) ont un dossier unique, actif, au nom d'adoption, qui mélange
 * encore soutenance et entretien — le mal qu'on voulait guérir. On le
 * détecte aux deux marqueurs présents à la fois, on désadopte, et le
 * découpage refait le travail proprement.
 */
export function reparerHeritageMelange(storage: StorageLike): void {
  const r = lireRegistre(storage);
  if (r.liste.length !== 1 || r.actif !== r.liste[0]!.id) return;
  const o = r.liste[0]!;
  if (o.nom !== "Ma soutenance" && o.nom !== "Mon entretien") return;
  const aSoutenance = storage.getItem("sc.deck.v1") !== null || storage.getItem("sc.ia.v1:rapport:texte") !== null;
  const aEntretien = storage.getItem("sc.candidature.v1") !== null;
  if (!aSoutenance || !aEntretien) return;
  (storage as StorageEnumerable).removeItem(CLE_REGISTRE);
  adopterEspaceExistant(storage);
}

/** Les clés qui appartiennent sans ambiguïté à la soutenance. */
function estCleSoutenance(k: string): boolean {
  return (
    k === "sc.deck.v1" ||
    k === "sc.ia.v1:rapport:texte" ||
    k === "sc.parcours.v1" ||
    k.startsWith("sc.ia.v1:relecture:") ||
    k.startsWith("sc.ia.v1:blanche:") ||
    k.startsWith("sc.ia.v1:coach:") ||
    k.startsWith("sc.ia.v1:fiches-etats:") ||
    k.startsWith("sc.ia.v1:appel-lecture:soutenance")
  );
}

/** Les clés qui appartiennent sans ambiguïté à l'entretien. */
function estCleEntretien(k: string): boolean {
  return k === "sc.candidature.v1" || k.startsWith("sc.ia.v1:appel-lecture:entretien") || k.startsWith("sc.ia.v1:questions");
}

/** Le mode d'un enregistrement (appel, session), enveloppe de cache ou non. */
function modeDe(brut: string): TypeOral | null {
  try {
    const j = JSON.parse(brut) as { mode?: unknown; donnee?: { mode?: unknown } };
    const m = (j.donnee && typeof j.donnee === "object" ? j.donnee.mode : undefined) ?? j.mode;
    return m === "entretien" ? "entretien" : m === "soutenance" ? "soutenance" : null;
  } catch {
    return null;
  }
}

/** La préférence de module telle que l'app la stocke, prête pour une archive. */
function envelopperModules(storage: StorageLike, type: TypeOral): string | null {
  sauverModulesActifs(storage, [type]);
  const v = storage.getItem("sc.ia.v1:preferences:modules");
  (storage as StorageEnumerable).removeItem("sc.ia.v1:preferences:modules");
  return v;
}

/**
 * Migration : un appareil d'avant les oraux a du travail sans dossier — et
 * souvent des DEUX types mélangés dans le même espace (le mal d'origine).
 * On DÉCOUPE : les affaires de soutenance dans un dossier « Ma soutenance »,
 * celles d'entretien dans « Mon entretien » (les appels et sessions suivent
 * chacun leur mode), et les deux partent dormir dans l'historique. L'espace
 * actif reste VIDE : on entre chez soi dans une pièce rangée — on rouvre un
 * ancien dossier quand on le décide, depuis « Mes oraux ».
 */
export function adopterEspaceExistant(storage: StorageLike): Oral[] | null {
  const r = lireRegistre(storage);
  if (r.liste.length > 0) return null;
  const cles = clesEspace(storage);
  if (cles.length === 0) return null;

  const sout: Record<string, string> = {};
  const entr: Record<string, string> = {};
  const sessionsSout: unknown[] = [];
  const sessionsEntr: unknown[] = [];

  for (const k of cles) {
    const v = storage.getItem(k);
    if (v === null) continue;
    if (k === "sc.ia.v1:preferences:modules") {
      // Regénérée par dossier plus bas.
    } else if (k === "sc.sessions.v1") {
      try {
        for (const rec of JSON.parse(v) as Array<{ mode?: unknown }>) {
          (rec && rec.mode === "entretien" ? sessionsEntr : sessionsSout).push(rec);
        }
      } catch {
        sout[k] = v;
      }
    } else if (estCleSoutenance(k)) {
      sout[k] = v;
    } else if (estCleEntretien(k)) {
      entr[k] = v;
    } else if (k.startsWith("sc.ia.v1:appel:") && k !== "sc.ia.v1:appel:questions-posees") {
      (modeDe(v) === "entretien" ? entr : sout)[k] = v;
    } else {
      // Par défaut chez la soutenance : c'est l'usage majoritaire.
      sout[k] = v;
    }
    (storage as StorageEnumerable).removeItem(k);
  }
  if (sessionsSout.length > 0) sout["sc.sessions.v1"] = JSON.stringify(sessionsSout);
  if (sessionsEntr.length > 0) entr["sc.sessions.v1"] = JSON.stringify(sessionsEntr);

  const crees: Oral[] = [];
  const ranger = (instantane: Record<string, string>, type: TypeOral, nom: string) => {
    if (Object.keys(instantane).length === 0) return;
    const modules = envelopperModules(storage, type);
    if (modules) instantane["sc.ia.v1:preferences:modules"] = modules;
    const oral: Oral = { id: crypto.randomUUID(), nom, type, creeLe: horodatage(), vuLe: horodatage() };
    try {
      storage.setItem(PREFIXE_ARCHIVE + oral.id, JSON.stringify(instantane));
      crees.push(oral);
    } catch {
      // Archive impossible (stockage plein) : on remet les clés en place
      // plutôt que de perdre le travail — l'espace redevient l'ancien monde.
      restaurer(storage, instantane);
    }
  };
  ranger(sout, "soutenance", "Ma soutenance");
  ranger(entr, "entretien", "Mon entretien");
  if (crees.length === 0) return null;
  ecrireRegistre(storage, { actif: null, liste: crees });
  return crees;
}
