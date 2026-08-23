/**
 * L'audio reste sur l'appareil : IndexedDB, jamais le serveur, jamais la
 * synchronisation. Une session = au plus un enregistrement.
 */

const BASE = "soutenance-coach";
const STORE = "audio";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponible"));
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
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

export async function sauverAudio(sessionId: string, blob: Blob): Promise<void> {
  try {
    await transaction("readwrite", (s) => s.put(blob, sessionId));
  } catch {
    /* stockage refusé (navigation privée, quota) : la session est sauvegardée sans audio */
  }
}

export async function lireAudio(sessionId: string): Promise<Blob | null> {
  try {
    const v = await transaction<Blob | undefined>("readonly", (s) => s.get(sessionId));
    return v instanceof Blob ? v : null;
  } catch {
    return null;
  }
}

export async function supprimerAudio(sessionId: string): Promise<void> {
  try {
    await transaction("readwrite", (s) => s.delete(sessionId));
  } catch {
    /* rien à supprimer */
  }
}

/** Les identifiants de sessions qui ont un audio — pour afficher le lecteur. */
export async function sessionsAvecAudio(): Promise<Set<string>> {
  try {
    const cles = await transaction<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return new Set(cles.map(String));
  } catch {
    return new Set();
  }
}

export async function toutEffacerAudio(): Promise<void> {
  try {
    await transaction("readwrite", (s) => s.clear());
  } catch {
    /* rien */
  }
}
