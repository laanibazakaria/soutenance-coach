/**
 * Synchronisation côté navigateur. Tout passe par le stockage local d'abord :
 * le compte n'est qu'une copie qui suit l'utilisateur d'un appareil à l'autre.
 * Aucune fonction ici ne lève d'exception — une synchronisation ratée ne doit
 * jamais empêcher de s'entraîner.
 */

import { listSessions, remplacerSessions } from "../storage";
import { listeDeckSauvegarde, sauverDeck } from "../slides/persistance";
import { fusionnerSessions, sessionsAPousser, fusionnerDeck, fusionnerIa, viderDonneesLocales } from "./merge";
import type { SessionRecord } from "../types";
import type { Deck } from "../slides/types";
import { fusionnerParcours, type Parcours } from "../parcours";
import { lireParcours, sauverParcours } from "../parcours/persistance";

const FLAG = "sc.connecte";
const PREFIXE_IA = "sc.ia.v1:";
const EVENEMENT = "sc:synchronise";

/**
 * Appelle `cb` après chaque synchronisation réussie. Les pages lisent le
 * stockage local au montage ; sans cela, ce que la synchronisation vient
 * d'écrire n'apparaîtrait qu'au prochain rechargement. Renvoie la fonction
 * de désabonnement (à retourner depuis un useEffect).
 */
export function surSynchronisation(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT, cb);
  return () => window.removeEventListener(EVENEMENT, cb);
}

/** Vrai si une synchronisation a réussi depuis la dernière connexion. */
export function estConnecte(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(FLAG) === "1";
}

export function marquerDeconnecte(): void {
  window.localStorage.removeItem(FLAG);
}

/** Toutes les entrées du cache IA local, par clé courte (sans préfixe). */
function lireToutIa(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k || !k.startsWith(PREFIXE_IA)) continue;
    try {
      out[k.slice(PREFIXE_IA.length)] = JSON.parse(ls.getItem(k) ?? "null");
    } catch {
      /* entrée corrompue : ignorée */
    }
  }
  return out;
}

function ecrireIa(entrees: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(entrees)) {
    if (window.localStorage.getItem(PREFIXE_IA + k) === null) {
      window.localStorage.setItem(PREFIXE_IA + k, JSON.stringify(v));
    }
  }
}

interface Distant {
  sessions: SessionRecord[];
  deck: Deck | null;
  ia: Record<string, unknown>;
  parcours?: Parcours | null;
}

async function envoyer(corps: {
  sessions?: SessionRecord[];
  deck?: Deck | null;
  ia?: Record<string, unknown>;
  parcours?: Parcours | null;
}) {
  const res = await fetch("/api/sync", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
  return res.ok;
}

/**
 * Synchronisation complète : récupère le distant, fusionne localement, pousse
 * ce que le serveur ne connaît pas. À appeler une fois connecté.
 */
export async function synchroniser(): Promise<{ ok: boolean; sessions: number }> {
  try {
    const res = await fetch("/api/sync");
    if (res.status === 401) {
      marquerDeconnecte();
      return { ok: false, sessions: 0 };
    }
    if (!res.ok) return { ok: false, sessions: 0 };
    const distant = (await res.json()) as Distant;

    const ls = window.localStorage;
    const locales = listSessions(ls);
    const fusion = fusionnerSessions(locales, distant.sessions ?? []);
    remplacerSessions(ls, fusion);

    const deckLocal = listeDeckSauvegarde(ls);
    const deck = fusionnerDeck(deckLocal, distant.deck ?? null);
    if (deck && !deckLocal) sauverDeck(ls, deck);

    const iaLocal = lireToutIa();
    ecrireIa(fusionnerIa(iaLocal, distant.ia ?? {}));

    const parcours = fusionnerParcours(lireParcours(ls), distant.parcours ?? null);
    if (parcours) sauverParcours(ls, parcours);

    await envoyer({
      sessions: sessionsAPousser(locales, distant.sessions ?? []),
      deck: deckLocal,
      ia: iaLocal,
      parcours,
    });
    ls.setItem(FLAG, "1");
    window.dispatchEvent(new Event(EVENEMENT));
    return { ok: true, sessions: fusion.length };
  } catch {
    return { ok: false, sessions: 0 };
  }
}

/** Après une écriture locale : pousse tout (idempotent côté serveur). */
export async function pousserTout(): Promise<void> {
  if (!estConnecte()) return;
  try {
    const ls = window.localStorage;
    await envoyer({ sessions: listSessions(ls), deck: listeDeckSauvegarde(ls), ia: lireToutIa(), parcours: lireParcours(ls) });
  } catch {
    /* réessayé à la prochaine synchronisation */
  }
}

/**
 * Avant de se déconnecter : un dernier envoi, puis l'appareil est vidé — le
 * travail reste sur le compte. Si le serveur est injoignable, on ne vide
 * rien ("conserve") : perdre une session serait pire que la laisser ici.
 */
export async function deconnexionPropre(): Promise<"vide" | "conserve"> {
  const ls = window.localStorage;
  try {
    const ok = await envoyer({ sessions: listSessions(ls), deck: listeDeckSauvegarde(ls), ia: lireToutIa(), parcours: lireParcours(ls) });
    if (!ok) return "conserve";
  } catch {
    return "conserve";
  }
  viderDonneesLocales(ls);
  return "vide";
}

/** Après une suppression locale : la répercute sur le compte. */
export async function supprimerDistante(id: string): Promise<void> {
  if (!estConnecte()) return;
  try {
    await fetch(`/api/sync/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* la session reviendra à la prochaine synchronisation : mieux vaut trop que perdu */
  }
}
