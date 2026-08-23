"use client";

import { useEffect, useState } from "react";
import { surSynchronisation } from "./sync/client";
import type { EtatQuota } from "./quota";

/**
 * L'état du quota IA, lu une fois pour toute la page et partagé entre la
 * barre du haut, la barre latérale et la cloche — au lieu d'un fetch par
 * composant. Rafraîchi toutes les deux minutes et après chaque synchronisation.
 */
export type EtatUsage = EtatQuota & { admin: boolean };

let courant: EtatUsage | null = null;
let enVol: Promise<void> | null = null;
const abonnes = new Set<(e: EtatUsage | null) => void>();

function diffuser() {
  for (const f of abonnes) f(courant);
}

export function rafraichirUsage(): Promise<void> {
  if (enVol) return enVol;
  enVol = fetch("/api/usage", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<EtatUsage>) : null))
    .then((e) => {
      if (e) {
        courant = e;
        diffuser();
      }
    })
    .catch(() => {})
    .finally(() => {
      enVol = null;
    });
  return enVol;
}

/** À appeler après un appel IA réussi : le compteur bouge tout de suite. */
export function signalerAppelIa(): void {
  if (courant) {
    courant = { ...courant, appels: courant.appels + 1, reste: Math.max(0, courant.reste - 1) };
    diffuser();
  }
  void rafraichirUsage();
}

export function useUsage(): EtatUsage | null {
  const [etat, setEtat] = useState<EtatUsage | null>(courant);
  useEffect(() => {
    abonnes.add(setEtat);
    setEtat(courant);
    void rafraichirUsage();
    const off = surSynchronisation(() => void rafraichirUsage());
    const t = setInterval(() => void rafraichirUsage(), 120_000);
    return () => {
      abonnes.delete(setEtat);
      off();
      clearInterval(t);
    };
  }, []);
  return etat;
}
