"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { synchroniser, marquerDeconnecte, deconnexionPropre } from "@/lib/sync/client";

/**
 * Le fil invisible entre le compte et l'appareil : synchronise à la connexion,
 * marque la déconnexion, et expose l'état aux coins de l'interface qui
 * l'affichent (pied de la barre latérale, page du compte).
 */
export type EtatSync = "local" | "sync" | "ok" | "erreur";

let courant: EtatSync = "local";
const abonnes = new Set<(e: EtatSync) => void>();
function poser(e: EtatSync) {
  courant = e;
  for (const f of abonnes) f(e);
}

export function useEtatSync(): EtatSync {
  const [etat, setEtat] = useState<EtatSync>(courant);
  useEffect(() => {
    abonnes.add(setEtat);
    setEtat(courant);
    return () => {
      abonnes.delete(setEtat);
    };
  }, []);
  return etat;
}

export function libelleSync(e: EtatSync): string {
  return e === "sync" ? "Synchronisation…" : e === "ok" ? "Synchronisé" : e === "erreur" ? "Hors ligne — données locales" : "100 % local";
}

/** Pousse ce qui reste, vide l'appareil, puis déconnecte. Demande confirmation si le serveur est injoignable. */
export async function seDeconnecterProprement(): Promise<boolean> {
  const resultat = await deconnexionPropre();
  if (
    resultat === "conserve" &&
    !window.confirm(
      "Le serveur est injoignable : tes dernières modifications ne sont pas encore sur ton compte. " +
        "Se déconnecter quand même ? Elles resteront visibles sur cet appareil.",
    )
  ) {
    return false;
  }
  await signOut({ callbackUrl: "/app" });
  return true;
}

export default function SyncCompte() {
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated") {
      poser("sync");
      void synchroniser().then((r) => poser(r.ok ? "ok" : "erreur"));
    } else if (status === "unauthenticated") {
      marquerDeconnecte();
      poser("local");
    }
  }, [status]);
  return null;
}
