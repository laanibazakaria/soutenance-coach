"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { creerOral, listeOraux, oralActif, renommerOral, supprimerOral, basculerSurOral, type Oral, type TypeOral } from "@/lib/oraux";
import { lireProfilEtudiant } from "@/lib/etudiant";
import FormulaireEtudiant from "../components/FormulaireEtudiant";

/**
 * Mes oraux : la liste des dossiers de travail. Chaque oral a un nom, un
 * type, et tout ce qui lui appartient — on en commence un nouveau, on
 * continue un ancien, rien ne s'écrase plus jamais.
 */

const EMOJI: Record<TypeOral, string> = { soutenance: "🎓", entretien: "💼" };
const LIBELLE: Record<TypeOral, string> = { soutenance: "Soutenance", entretien: "Entretien d'embauche" };

function dateCourte(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export default function OrauxPage() {
  return (
    <Suspense fallback={null}>
      <OrauxInner />
    </Suspense>
  );
}

function OrauxInner() {
  const [oraux, setOraux] = useState<Oral[]>([]);
  const [actifId, setActifId] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeOral>("soutenance");
  const [renomme, setRenomme] = useState<string | null>(null);
  const [nouveauNom, setNouveauNom] = useState("");
  const [confirme, setConfirme] = useState<string | null>(null);
  /** Après le premier oral : le jury doit savoir d'où parle le candidat. */
  const [etapeProfil, setEtapeProfil] = useState<string | null>(null);
  const params = useSearchParams();

  useEffect(() => {
    const t = params.get("type");
    if (t === "soutenance" || t === "entretien") setType(t);
  }, [params]);

  const recharger = () => {
    setOraux(listeOraux(window.localStorage));
    setActifId(oralActif(window.localStorage)?.id ?? null);
  };
  useEffect(recharger, []);

  function destination(t: TypeOral): string {
    return t === "soutenance" ? "/app/documents" : "/app/entretien";
  }

  function commencer() {
    if (!nom.trim()) return;
    const premier = listeOraux(window.localStorage).length === 0;
    const o = creerOral(window.localStorage, nom, type);
    // Au premier oral, le jury fait connaissance : un jury de l'ENSIAS en IA
    // ne pose pas les mêmes questions qu'un jury de médecine.
    if (premier && !lireProfilEtudiant(window.localStorage)) {
      setEtapeProfil(destination(o.type));
      return;
    }
    // Navigation entière : chaque page relit son espace de travail au chargement.
    window.location.assign(destination(o.type));
  }

  function continuer(o: Oral) {
    if (o.id !== actifId) basculerSurOral(window.localStorage, o.id);
    window.location.assign("/app");
  }

  if (etapeProfil) {
    return (
      <div className="choix">
        <h2 className="onboarding-title">Fais connaissance avec ton jury</h2>
        <p className="onboarding-lead">Dis-lui d&apos;où tu parles : un jury de l&apos;ENSIAS en IA ne pose pas les mêmes questions qu&apos;un jury de médecine.</p>
        <FormulaireEtudiant onFait={() => window.location.assign(etapeProfil)} libelleValider="C'est parti" />
      </div>
    );
  }

  return (
    <div className="oraux">
      <section className="oraux-nouveau">
        <h2>Commencer un nouvel oral</h2>
        <p className="session-meta">Donne-lui un nom — tu le retrouveras ici, avec ses documents, ses appels et sa progression, même après avoir fermé la plateforme.</p>
        <div className="oraux-form">
          <input
            type="text"
            value={nom}
            maxLength={60}
            placeholder={type === "soutenance" ? "Ex. : PFA, PFE, mémoire, thèse — ton sujet" : "Ex. : le poste et l'entreprise"}
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commencer();
            }}
          />
          <div className="oraux-types" role="radiogroup" aria-label="Type d'oral">
            {(Object.keys(LIBELLE) as TypeOral[]).map((t) => (
              <button key={t} type="button" className={`format-btn${type === t ? " active" : ""}`} aria-pressed={type === t} onClick={() => setType(t)}>
                {EMOJI[t]} {LIBELLE[t]}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={commencer} disabled={!nom.trim()}>
            Créer et commencer
          </button>
        </div>
        {oraux.length === 0 && (
          <p className="onboarding-alt">
            Tu veux d&apos;abord voir à quoi ça ressemble ? <a href="/demo-capture.html?vers=/app">Ouvrir avec un exemple</a>
          </p>
        )}
      </section>

      {oraux.length > 0 && (
        <section>
          <h2>Continuer un oral</h2>
          <ul className="oraux-liste">
            {oraux.map((o) => (
              <li key={o.id} className={o.id === actifId ? "actif" : ""}>
                <button type="button" className="oraux-corps" onClick={() => continuer(o)}>
                  <span className="oraux-emoji" aria-hidden="true">
                    {EMOJI[o.type]}
                  </span>
                  <span className="oraux-texte">
                    <b>{o.nom}</b>
                    <small>
                      {LIBELLE[o.type]} · commencé le {dateCourte(o.creeLe)}
                      {o.id === actifId ? " · en cours" : ""}
                    </small>
                  </span>
                </button>
                <span className="oraux-actions">
                  {renomme === o.id ? (
                    <>
                      <input
                        type="text"
                        value={nouveauNom}
                        maxLength={60}
                        autoFocus
                        onChange={(e) => setNouveauNom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renommerOral(window.localStorage, o.id, nouveauNom);
                            setRenomme(null);
                            recharger();
                          }
                          if (e.key === "Escape") setRenomme(null);
                        }}
                      />
                      <button
                        className="btn ghost"
                        onClick={() => {
                          renommerOral(window.localStorage, o.id, nouveauNom);
                          setRenomme(null);
                          recharger();
                        }}
                      >
                        OK
                      </button>
                    </>
                  ) : confirme === o.id ? (
                    <>
                      <button
                        className="btn danger"
                        onClick={() => {
                          supprimerOral(window.localStorage, o.id);
                          setConfirme(null);
                          recharger();
                        }}
                      >
                        Supprimer définitivement
                      </button>
                      <button className="btn ghost" onClick={() => setConfirme(null)}>
                        Garder
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setRenomme(o.id);
                          setNouveauNom(o.nom);
                        }}
                      >
                        Renommer
                      </button>
                      <button className="btn ghost" onClick={() => setConfirme(o.id)}>
                        Supprimer
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
