/**
 * Les passages vectorisés du mémoire restent sur l'appareil (IndexedDB) :
 * ils sont volumineux, ils n'ont rien à faire dans la synchronisation, et la
 * recherche se fait dans le navigateur — le serveur ne voit qu'une question
 * à la fois.
 */

import type { PassageVectorise } from "./index";

const BASE = "soutenance-coach";
const STORE = "memoire";
const CLE = "passages";

export interface MemoireIndexee {
  /** Empreinte du texte : si le mémoire change, l'index est refait. */
  empreinte: string;
  nomFichier: string;
  passages: PassageVectorise[];
  indexeLe: string;
}

/** Empreinte courte et stable d'un texte (pas une signature : juste un repère). */
export function empreinte(texte: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}-${texte.length}`;
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponible"));
    // Version 2 : la base existait déjà pour l'audio.
    const req = indexedDB.open(BASE, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("audio")) db.createObjectStore("audio");
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return ouvrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function lireIndex(): Promise<MemoireIndexee | null> {
  try {
    return (await transaction<MemoireIndexee | undefined>("readonly", (s) => s.get(CLE))) ?? null;
  } catch {
    return null;
  }
}

export async function sauverIndex(index: MemoireIndexee): Promise<void> {
  try {
    await transaction("readwrite", (s) => s.put(index, CLE));
  } catch {
    /* pas d'IndexedDB : on se passera de la recherche */
  }
}

export async function effacerIndex(): Promise<void> {
  try {
    await transaction("readwrite", (s) => s.delete(CLE));
  } catch {
    /* rien à effacer */
  }
}
