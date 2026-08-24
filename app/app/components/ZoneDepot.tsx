"use client";

import { useRef, useState } from "react";
import { Icone, IconeBadge, type NomIcone } from "@/app/components/Icone";

/**
 * Une zone où l'on dépose un document : on y glisse un fichier, ou on clique.
 * Elle dit toujours ce qu'elle contient — un dépôt muet laisse l'étudiant se
 * demander si ça a marché.
 */
export interface EtatDepot {
  nomFichier: string;
  detail: string;
}

export default function ZoneDepot({
  titre,
  aquoiCaSert,
  icone,
  etat,
  occupe,
  onFichier,
  accept = "application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",
}: {
  titre: string;
  aquoiCaSert: string;
  icone: NomIcone;
  etat: EtatDepot | null;
  occupe?: boolean;
  onFichier: (f: File) => void;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const rempli = etat !== null;

  return (
    <div
      className={`depot${rempli ? " rempli" : ""}${survol ? " survol" : ""}${occupe ? " occupe" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !occupe) onFichier(f);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFichier(f);
          e.target.value = "";
        }}
      />
      <IconeBadge nom={rempli ? "valide" : icone} teinte={rempli ? "vert" : "gris"} taille={40} rond />
      <div className="depot-texte">
        <b>{titre}</b>
        {rempli ? (
          <>
            <span className="depot-fichier">{etat.nomFichier}</span>
            <small>{etat.detail}</small>
          </>
        ) : (
          <small>{aquoiCaSert}</small>
        )}
      </div>
      <button type="button" className={`btn small${rempli ? "" : " primary"}`} onClick={() => ref.current?.click()} disabled={occupe}>
        {occupe ? "Lecture…" : rempli ? "Remplacer" : <><Icone nom="memoire" /> Déposer</>}
      </button>
    </div>
  );
}
