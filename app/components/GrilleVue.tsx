"use client";

import { pronostiquer } from "@/lib/grille/pronostic";
import { useState } from "react";
import { mention, niveauCritere, NOTE_MAX, type Evaluation } from "@/lib/grille";
import { Icone } from "@/app/components/Icone";

/**
 * La grille remplie : une note, puis les douze critères avec ce que le jury a
 * observé et tes propres mots. La note vient du code, pas du modèle — et on le
 * dit, parce que c'est ce qui la rend crédible.
 */
export default function GrilleVue({ evaluation, titre = "Ta grille d'évaluation" }: { evaluation: Evaluation; titre?: string }) {
  const [tout, setTout] = useState(false);
  const { note, criteres, prioritaires, acquis, insuffisant, volets } = evaluation;
  const pourcent = note === null ? 0 : Math.round((note / NOTE_MAX) * 100);
  const pronostic = pronostiquer(evaluation);
  const niveauNote = note === null ? "absent" : note >= 7 ? "bon" : note >= 5.5 ? "attention" : "alerte";
  const visibles = tout ? criteres : criteres.filter((c) => c.note !== null);

  return (
    <section className="grille" aria-label={titre}>
      {pronostic && (
        <div className="card pronostic">
          <span className="pronostic-libelle">Si ton oral était demain</span>
          <b className="pronostic-fourchette">
            entre {pronostic.basse.toLocaleString("fr-FR")} et {pronostic.haute.toLocaleString("fr-FR")} / 20
          </b>
          <small>
            Fourchette calculée depuis la grille ci-dessous — une estimation honnête, pas une promesse.
            {pronostic.reserve ? ` ${pronostic.reserve}` : ""}
          </small>
        </div>
      )}
      <div className="card grille-tete">
        <div className="grille-jauge">
          <span className={`grille-note grille-note-${niveauNote}`}>
            {note === null ? "—" : note.toFixed(1)}
            <small>/ {NOTE_MAX}</small>
          </span>
          <span className="grille-mention">{mention(note, volets)}</span>
          <div className="grille-barre" role="img" aria-label={note === null ? "note non calculable" : `${note} sur ${NOTE_MAX}`}>
            <span className={`grille-barre-remplie grille-barre-${niveauNote}`} style={{ width: `${pourcent}%` }} />
          </div>
        </div>
        <div className="grille-resume">
          <h3 className="list-title" style={{ margin: 0 }}>
            {titre}
          </h3>
          {insuffisant ? (
            <p className="session-meta">L&apos;échange était trop court pour noter : réponds à trois ou quatre questions de plus et la grille se remplira.</p>
          ) : (
            <p className="session-meta">
              {criteres.filter((c) => c.note !== null).length} critères sur {criteres.length} ont pu être évalués. La note est la moyenne pondérée, <b>calculée par du code</b> — le modèle juge, il ne compte pas.
            </p>
          )}
          {prioritaires.length > 0 && (
            <p className="grille-priorites">
              <Icone nom="cible" taille={15} /> À travailler d&apos;abord : <b>{prioritaires.map((c) => c.titre).join(", ")}</b>
            </p>
          )}
          {acquis.length > 0 && (
            <p className="grille-acquis">
              <Icone nom="valide" taille={15} /> Déjà solide : {acquis.slice(0, 4).map((c) => c.titre).join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="grille-criteres">
        {visibles.map((c) => {
          const n = niveauCritere(c.note);
          return (
            <article key={c.id} className={`card grille-critere grille-critere-${n}`}>
              <div className="grille-critere-tete">
                <span className="grille-critere-titre">
                  {c.titre}
                  <small>coefficient {c.poids}</small>
                </span>
                <span className={`grille-critere-note grille-critere-note-${n}`}>{c.note === null ? "non évalué" : `${c.note}/10`}</span>
              </div>
              {c.constat && <p className="grille-constat">{c.constat}</p>}
              {c.citation && <blockquote className="grille-citation">« {c.citation} »</blockquote>}
              {c.conseil && (
                <p className="grille-conseil">
                  <Icone nom="fleche" taille={14} /> {c.conseil}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {visibles.length < criteres.length && (
        <button className="link-btn" onClick={() => setTout((v) => !v)} aria-expanded={tout}>
          {tout ? "Masquer" : "Voir"} les {criteres.length - visibles.length} critères non évalués {tout ? "▾" : "▸"}
        </button>
      )}
      <p className="report-note">
        Chaque note est justifiée par ce que tu as dit. La moyenne pondérée est recalculée par du code déterministe : une analyse peut être fausse, une addition ne doit pas l&apos;être.
      </p>
    </section>
  );
}
