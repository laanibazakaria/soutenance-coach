"use client";

import { NOTE_MAX } from "@/lib/grille";
import { resumer, type CritereSuivi, type Progression } from "@/lib/grille/progression";
import { Icone } from "@/app/components/Icone";

/** Une mini-courbe : les notes d'un critère, oral après oral. */
function Courbe({ notes }: { notes: number[] }) {
  if (notes.length < 2) return null;
  const l = 96;
  const h = 26;
  const points = notes.map((n, i) => `${(i / (notes.length - 1)) * l},${h - (n / NOTE_MAX) * h}`).join(" ");
  const dernier = notes[notes.length - 1]!;
  return (
    <svg className="suivi-courbe" viewBox={`0 0 ${l + 4} ${h + 4}`} width={l + 4} height={h + 4} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="translate(2,2)" />
      <circle cx={l + 2} cy={h - (dernier / NOTE_MAX) * h + 2} r="2.6" fill="currentColor" />
    </svg>
  );
}

function Ligne({ c }: { c: CritereSuivi }) {
  const signe = c.ecart > 0 ? "+" : "";
  return (
    <div className={`suivi-ligne suivi-${c.sens}`}>
      <span className="suivi-titre">{c.titre}</span>
      <Courbe notes={c.notes} />
      <span className="suivi-chiffres">
        <b>{c.premiere}</b> → <b>{c.derniere}</b>
        <small>
          {signe}
          {c.ecart}
        </small>
      </span>
    </div>
  );
}

/**
 * La progression d'un oral à l'autre : ce qui monte, ce qui bloque. C'est la
 * partie du concept Propulsez qui transforme une note en parcours — une note
 * seule ne dit pas si on s'améliore.
 */
export default function ProgressionGrille({ progression }: { progression: Progression }) {
  const p = progression;
  if (!p.exploitable) {
    return (
      <div className="card teaser">
        <Icone nom="tendance" /> {resumer(p)}
      </div>
    );
  }
  const stables = p.criteres.filter((c) => c.sens === "stable" && c.derniere >= 6);

  return (
    <section className="suivi" aria-label="Ma progression">
      <div className="card suivi-tete">
        <div>
          <h3 className="list-title" style={{ margin: 0 }}>
            <Icone nom="tendance" taille={18} /> D&apos;un oral à l&apos;autre
          </h3>
          <p className="session-meta">{resumer(p)}</p>
        </div>
        {p.ecartNote !== null && (
          <span className={`suivi-note suivi-${p.sens}`}>
            {p.noteDebut} → {p.noteFin}
            <small>
              {p.ecartNote > 0 ? "+" : ""}
              {p.ecartNote}
            </small>
          </span>
        )}
      </div>

      {p.progresse.length > 0 && (
        <div className="suivi-groupe">
          <h4>
            <Icone nom="valide" taille={15} /> Ce qui progresse
          </h4>
          {p.progresse.map((c) => (
            <Ligne key={c.id} c={c} />
          ))}
        </div>
      )}

      {p.bloque.length > 0 && (
        <div className="suivi-groupe">
          <h4>
            <Icone nom="alerte" taille={15} /> Ce qui ne bouge pas
          </h4>
          {p.bloque.map((c) => (
            <Ligne key={c.id} c={c} />
          ))}
          <p className="report-note a-gauche">
            Répéter à l&apos;identique ne suffira pas : sur ces points, change de méthode — écris la réponse, fais-la relire, ou demande à quelqu&apos;un de te la poser.
          </p>
        </div>
      )}

      {stables.length > 0 && (
        <p className="suivi-stables">
          Solide et stable : {stables.map((c) => c.titre).join(", ")}.
        </p>
      )}
    </section>
  );
}
