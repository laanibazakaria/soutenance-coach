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
import { fusionnerCandidature, type Candidature } from "../entretien";
import { lireCandidature, sauverCandidature } from "../entretien/persistance";
import { toutEffacerAudio } from "../audio/stockage";
import { oublierMemoire } from "../memoire/client";
import { listeOraux, oralActif, instantaneEspace, archiveBrute, fusionnerMondeOraux } from "../oraux";

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

/** Prévient les composants abonnés qu'une donnée locale partagée a changé (préférences). */
export function signalerSynchronisation(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT));
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

/**
 * Le monde des oraux, glissé dans le canal ia sous des clés réservées
 * « oraux:* » (zéro changement serveur). L'espace vif voyage comme archive
 * de l'oral actif : le compte connaît TOUS les dossiers, pas seulement
 * celui qui est ouvert.
 */
function chargerOraux(entrees: Record<string, unknown>): void {
  const ls = window.localStorage;
  const registre = ls.getItem("sc.oraux.v1");
  if (!registre) return;
  entrees["oraux:registre"] = registre;
  const actif = oralActif(ls);
  for (const o of listeOraux(ls)) {
    const brut = o.id === actif?.id ? JSON.stringify(instantaneEspace(ls)) : archiveBrute(ls, o.id);
    if (brut) entrees[`oraux:archive:${o.id}`] = brut;
  }
}

function ecrireIa(entrees: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(entrees)) {
    if (k.startsWith("oraux:")) continue; // le monde des oraux a son propre chemin
    if (window.localStorage.getItem(PREFIXE_IA + k) === null) {
      window.localStorage.setItem(PREFIXE_IA + k, JSON.stringify(v));
    }
  }
}

/** Le monde des oraux du compte, extrait du canal ia. */
function extraireOraux(ia: Record<string, unknown>): { registre: unknown; archives: Record<string, string> } | null {
  const registre = ia["oraux:registre"];
  if (registre === undefined) return null;
  const archives: Record<string, string> = {};
  for (const [k, v] of Object.entries(ia)) {
    if (k.startsWith("oraux:archive:") && typeof v === "string") archives[k.slice("oraux:archive:".length)] = v;
  }
  return { registre, archives };
}

interface Distant {
  sessions: SessionRecord[];
  deck: Deck | null;
  ia: Record<string, unknown>;
  parcours?: Parcours | null;
  candidature?: Candidature | null;
}


async function envoyer(corps: {
  sessions?: SessionRecord[];
  deck?: Deck | null;
  ia?: Record<string, unknown>;
  parcours?: Parcours | null;
  candidature?: Candidature | null;
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
    const mondeDistant = extraireOraux(distant.ia ?? {});

    if (mondeDistant) {
      // Compte MIGRÉ aux dossiers : le monde des oraux est la seule vérité.
      // Les champs à plat du compte sont l'espace actif d'UN appareil — les
      // fusionner ici re-remplirait un dossier vide avec le travail d'un
      // autre (le bug vu en vrai le 30/08). On ne touche plus à l'espace vif.
      fusionnerMondeOraux(ls, mondeDistant.registre, mondeDistant.archives);
    } else {
      // Compte d'avant les dossiers : l'ancienne fusion à plat, une dernière
      // fois — l'adoption locale rangera, puis le prochain envoi migrera le
      // compte.
      const fusion = fusionnerSessions(locales, distant.sessions ?? []);
      remplacerSessions(ls, fusion);

      const deckLocal0 = listeDeckSauvegarde(ls);
      const deck = fusionnerDeck(deckLocal0, distant.deck ?? null);
      if (deck && !deckLocal0) sauverDeck(ls, deck);

      ecrireIa(fusionnerIa(lireToutIa(), distant.ia ?? {}));

      const parcours = fusionnerParcours(lireParcours(ls), distant.parcours ?? null);
      if (parcours) sauverParcours(ls, parcours);
      const candidature = fusionnerCandidature(lireCandidature(ls), distant.candidature ?? null);
      if (candidature) sauverCandidature(ls, candidature);
    }

    const iaLocal = lireToutIa();
    chargerOraux(iaLocal);
    await envoyer({
      sessions: sessionsAPousser(listSessions(ls), distant.sessions ?? []),
      deck: listeDeckSauvegarde(ls),
      ia: iaLocal,
      parcours: lireParcours(ls),
      candidature: lireCandidature(ls),
    });
    ls.setItem(FLAG, "1");
    window.dispatchEvent(new Event(EVENEMENT));
    return { ok: true, sessions: listSessions(window.localStorage).length };
  } catch {
    return { ok: false, sessions: 0 };
  }
}

/** Après une écriture locale : pousse tout (idempotent côté serveur). */
export async function pousserTout(): Promise<void> {
  if (!estConnecte()) return;
  try {
    const ls = window.localStorage;
    const ia = lireToutIa();
    chargerOraux(ia);
    await envoyer({ sessions: listSessions(ls), deck: listeDeckSauvegarde(ls), ia, parcours: lireParcours(ls), candidature: lireCandidature(ls) });
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
    const iaFinal = lireToutIa();
    chargerOraux(iaFinal);
    const ok = await envoyer({ sessions: listSessions(ls), deck: listeDeckSauvegarde(ls), ia: iaFinal, parcours: lireParcours(ls), candidature: lireCandidature(ls) });
    if (!ok) return "conserve";
  } catch {
    return "conserve";
  }
  viderDonneesLocales(ls);
  void toutEffacerAudio();
  void oublierMemoire();
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
