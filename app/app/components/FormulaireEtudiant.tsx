"use client";

import { useEffect, useState } from "react";
import { lireProfilEtudiant, sauverProfilEtudiant } from "@/lib/etudiant";
import { pousserTout, signalerSynchronisation } from "@/lib/sync/client";

/**
 * Le profil étudiant en trois champs : école, filière, niveau. Le jury IA
 * s'en sert pour parler juste, et « raconte ton oral » arrive pré-rempli.
 * Utilisé à l'onboarding (avec bouton passer) et dans Mon compte.
 */
export default function FormulaireEtudiant({ onFait, libelleValider = "Enregistrer", compact = false }: { onFait?: () => void; libelleValider?: string; compact?: boolean }) {
  const [ecole, setEcole] = useState("");
  const [filiere, setFiliere] = useState("");
  const [niveau, setNiveau] = useState("");
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    const p = lireProfilEtudiant(window.localStorage);
    if (p) {
      setEcole(p.ecole);
      setFiliere(p.filiere);
      setNiveau(p.niveau);
    }
  }, []);

  function valider(e: React.FormEvent) {
    e.preventDefault();
    sauverProfilEtudiant(window.localStorage, { ecole, filiere, niveau });
    signalerSynchronisation();
    void pousserTout();
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2500);
    onFait?.();
  }

  return (
    <form className={compact ? "etudiant-form" : "etudiant-form card"} onSubmit={valider}>
      {!compact && (
        <p className="session-meta" style={{ marginBottom: 4 }}>
          Facultatif — mais le jury IA parle plus juste quand il sait à qui il parle, et « raconte ton oral » sera pré-rempli.
        </p>
      )}
      <div className="champs-ligne">
        <label className="champ">
          <span>École / université</span>
          <input type="text" value={ecole} onChange={(e) => setEcole(e.target.value)} placeholder="ENSIAS, EMI, FST…" autoComplete="organization" />
        </label>
        <label className="champ">
          <span>Filière</span>
          <input type="text" value={filiere} onChange={(e) => setFiliere(e.target.value)} placeholder="IA, Génie logiciel, Data…" />
        </label>
        <label className="champ">
          <span>Niveau</span>
          <input type="text" value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="PFA, PFE, M2, doctorat…" />
        </label>
      </div>
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button className="btn primary" type="submit">
          {enregistre ? "Enregistré ✓" : libelleValider}
        </button>
        {onFait && (
          <button className="btn" type="button" onClick={onFait}>
            Passer
          </button>
        )}
      </div>
    </form>
  );
}
