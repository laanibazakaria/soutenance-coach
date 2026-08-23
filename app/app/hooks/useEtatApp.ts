"use client";

import { useEffect, useState } from "react";
import { listSessions } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";
import { lireModulesActifs, resumerModules, type ModuleActif, type ResumeModule } from "@/lib/preferences";
import { lireCache } from "@/lib/ia-cache";
import { dateDuJour } from "@/lib/parcours";
import { surSynchronisation } from "@/lib/sync/client";

export interface EtatApp {
  sessions: SessionRecord[];
  actifs: ModuleActif[] | null;
  resumes: ResumeModule[];
  qdjFaite: boolean;
  aujourdhui: string;
}

/**
 * Ce que la coquille a besoin de savoir (oraux actifs, échéances, question du
 * jour), relu après chaque synchronisation. `null` tant que rien n'est lu —
 * le rendu serveur n'a pas accès au navigateur.
 */
export function useEtatApp(): EtatApp | null {
  const [etat, setEtat] = useState<EtatApp | null>(null);
  useEffect(() => {
    const lire = () => {
      const aujourdhui = dateDuJour();
      const sessions = listSessions(window.localStorage);
      const actifs = lireModulesActifs(window.localStorage);
      setEtat({
        sessions,
        actifs,
        resumes: actifs ? resumerModules(window.localStorage, sessions, actifs, aujourdhui) : [],
        qdjFaite: lireCache(window.localStorage, `qdj:${aujourdhui}`) !== null,
        aujourdhui,
      });
    };
    lire();
    const off = surSynchronisation(lire);
    window.addEventListener("focus", lire);
    return () => {
      off();
      window.removeEventListener("focus", lire);
    };
  }, []);
  return etat;
}

/** L'oral le plus proche (date dans le futur), sinon le premier commencé. */
export function oralPrioritaire(resumes: ResumeModule[]): ResumeModule | null {
  const datés = resumes.filter((r) => r.jours !== null && r.jours >= 0).sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0));
  return datés[0] ?? resumes.find((r) => r.pourcent !== null) ?? resumes[0] ?? null;
}
