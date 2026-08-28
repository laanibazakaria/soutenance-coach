"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { lireCache } from "@/lib/ia-cache";
import { calculerSerie, phraseSerie, type Serie } from "@/lib/quotidien";
import { dateDuJour } from "@/lib/parcours";
import { surSynchronisation } from "@/lib/sync/client";
import { Icone, IconeBadge } from "@/app/components/Icone";

/** Sur l'accueil : la question du jour (faite ou pas), la série, et le bouton des rappels. */
export default function CarteQuotidien() {
  const aujourdhui = dateDuJour();
  const [serie, setSerie] = useState<Serie | null>(null);
  const [faite, setFaite] = useState(false);

  useEffect(() => {
    const lire = () => {
      setSerie(lireCache<Serie>(window.localStorage, "serie"));
      setFaite(lireCache(window.localStorage, `qdj:${aujourdhui}`) !== null);
    };
    lire();
    return surSynchronisation(lire);
  }, [aujourdhui]);

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
    </div>
  );
}
