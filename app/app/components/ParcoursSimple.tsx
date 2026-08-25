"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icone } from "@/app/components/Icone";
import { surSynchronisation } from "@/lib/sync/client";
import { lireParcoursSimple, type ParcoursSimple as Etat } from "@/lib/parcours-simple";

/**
 * Le fil conducteur, en tête de l'accueil : quatre étapes dans l'ordre, l'état
 * réel de chacune, et UNE action mise en avant — la prochaine. Un étudiant qui
 * arrive doit comprendre quoi faire en dix secondes, sans lire de mode
 * d'emploi : c'est ce bloc qui porte cette promesse.
 */
export default function ParcoursSimple() {
  const [parcours, setParcours] = useState<Etat | null>(null);

  useEffect(() => {
    const lire = () => setParcours(lireParcoursSimple(window.localStorage));
    lire();
    return surSynchronisation(lire);
  }, []);

  if (!parcours) return null;

  return (
    <section className="fil" aria-label="Ton parcours en quatre étapes">
      <ol className="fil-etapes">
        {parcours.etapes.map((e) => {
          const courante = e.numero === parcours.courante;
          return (
            <li key={e.numero} className={`fil-etape fil-${e.etat}${courante ? " fil-courante" : ""}`}>
              <span className="fil-numero" aria-hidden="true">
                {e.etat === "faite" ? <Icone nom="check" taille={14} /> : e.numero}
              </span>
              <div className="fil-corps">
                <b>{e.titre}</b>
                <small>{e.detail}</small>
                {e.lien && e.action && (
                  <Link href={e.lien} className={`btn small${courante ? " primary" : ""}`}>
                    {e.action}
                    {courante ? " →" : ""}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
