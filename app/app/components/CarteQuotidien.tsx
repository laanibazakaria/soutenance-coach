"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { lireCache } from "@/lib/ia-cache";
import { calculerSerie, phraseSerie, type Serie } from "@/lib/quotidien";
import { dateDuJour } from "@/lib/parcours";
import { surSynchronisation } from "@/lib/sync/client";
import { pushDisponible, etatPush, activerPush, desactiverPush, type EtatPush } from "@/lib/push-client";
import { useToast } from "@/app/components/Toast";
import { Icone, IconeBadge } from "@/app/components/Icone";

/** Sur l'accueil : la question du jour (faite ou pas), la série, et le bouton des rappels. */
export default function CarteQuotidien() {
  const aujourdhui = dateDuJour();
  const [serie, setSerie] = useState<Serie | null>(null);
  const [faite, setFaite] = useState(false);
  const [push, setPush] = useState<EtatPush>("indisponible");
  const [occupe, setOccupe] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const lire = () => {
      setSerie(lireCache<Serie>(window.localStorage, "serie"));
      setFaite(lireCache(window.localStorage, `qdj:${aujourdhui}`) !== null);
    };
    lire();
    void etatPush().then(setPush);
    return surSynchronisation(lire);
  }, [aujourdhui]);

  async function basculerPush() {
    setOccupe(true);
    try {
      if (push === "actif") {
        await desactiverPush();
        setPush("inactif");
        toast.info("Rappels désactivés.");
      } else {
        const e = await activerPush();
        setPush(e);
        if (e === "actif") toast.success("Rappels activés : un par jour, le soir — J-X, la veille, la question du jour.");
        else if (e === "refuse") toast.error("Les notifications sont bloquées dans le navigateur. Autorise-les dans les réglages du site.");
        else toast.error("Impossible d'activer les rappels ici.");
      }
    } finally {
      setOccupe(false);
    }
  }

  const e = calculerSerie(serie, aujourdhui);
  return (
    <div className="card accueil-quotidien">
      <div className="accueil-quotidien-principal">
        <IconeBadge nom={e.courante >= 3 ? "flamme" : "cible"} teinte={e.courante >= 3 ? "or" : "violet"} />
        <div>
          <b>{faite ? "Question du jour : faite ✓" : "La question du jour"}</b>
          <p className="session-meta">{phraseSerie(e)}</p>
        </div>
        <Link href="/app/question-du-jour" className={`btn small${faite ? "" : " primary"}`}>
          {faite ? "Revoir" : <><Icone nom="micro" /> Une minute</>}
        </Link>
      </div>
      {pushDisponible() && push !== "refuse" && (
        <div className="accueil-quotidien-push">
          <span className="session-meta">{push === "actif" ? <><Icone nom="cloche" /> Rappels activés — un par jour, le soir.</> : <><Icone nom="clocheBarree" /> Un rappel par jour (J-X, la veille, la question du jour) ?</>}</span>
          <button className="btn small" onClick={() => void basculerPush()} disabled={occupe}>
            {occupe ? "…" : push === "actif" ? "Désactiver" : "Activer les rappels"}
          </button>
        </div>
      )}
    </div>
  );
}
