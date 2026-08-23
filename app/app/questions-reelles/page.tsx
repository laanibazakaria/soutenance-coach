"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LIBELLES_TYPE_ORAL, TYPES_ORAL, type TypeOral } from "@/lib/retours";
import { Icone } from "@/app/components/Icone";

interface Groupe {
  ecole: string;
  filiere: string;
  type: TypeOral;
  nb: number;
  questions: string[];
  conseils: string[];
}

/** Les vraies questions des vrais jurys, par école et filière — racontées par les étudiants passés avant. */
export default function QuestionsReellesPage() {
  const [type, setType] = useState<TypeOral | "tous">("tous");
  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const [total, setTotal] = useState(0);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    setGroupes(null);
    fetch(`/api/retours${type === "tous" ? "" : `?type=${type}`}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { groupes: Groupe[]; total: number }) => {
        setGroupes(j.groupes);
        setTotal(j.total);
      })
      .catch(() => setGroupes([]));
  }, [type]);

  const q = recherche.trim().toLowerCase();
  const visibles = (groupes ?? []).filter((g) => q === "" || g.ecole.toLowerCase().includes(q) || g.filiere.toLowerCase().includes(q) || g.questions.some((x) => x.toLowerCase().includes(q)));

  return (
    <div className="reelles">
      <div className="toolbar">
        <div className="filtres" role="group" aria-label="Type d'oral">
          <button type="button" className={`format-btn${type === "tous" ? " active" : ""}`} onClick={() => setType("tous")}>Tous</button>
          {TYPES_ORAL.map((t) => (
            <button key={t} type="button" className={`format-btn${type === t ? " active" : ""}`} onClick={() => setType(t)}>{LIBELLES_TYPE_ORAL[t]}</button>
          ))}
        </div>
        <span className="session-meta">{total} témoignage{total > 1 ? "s" : ""}</span>
      </div>
      <label className="champ champ-large recherche">
        <span className="sr-only">Rechercher une école, une filière, un mot</span>
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une école, une filière, un mot…" />
      </label>

      {groupes === null ? (
        <div className="card teaser">Chargement…</div>
      ) : visibles.length === 0 ? (
        <div className="card teaser">
          {total === 0 ? (
            <>
              Personne n&apos;a encore raconté son oral. Après le tien, reviens ici : <b>deux minutes</b> pour les suivants. Les questions apparaissent après relecture.
            </>
          ) : (
            "Rien ne correspond."
          )}
        </div>
      ) : (
        visibles.map((g) => (
          <article key={`${g.type}-${g.ecole}-${g.filiere}`} className="card reelles-groupe">
            <div className="list-head" style={{ margin: 0 }}>
              <div>
                <h2 className="list-title" style={{ margin: 0 }}>{g.ecole} · {g.filiere}</h2>
                <p className="session-meta">{LIBELLES_TYPE_ORAL[g.type]} · {g.nb} témoignage{g.nb > 1 ? "s" : ""} · {g.questions.length} question{g.questions.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <ol className="reelles-liste">
              {g.questions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            {g.conseils.length > 0 && (
              <p className="session-meta"><Icone nom="message" /> {g.conseils.map((c) => `« ${c} »`).join(" · ")}</p>
            )}
          </article>
        ))
      )}
      <p className="report-note" style={{ marginTop: 18 }}>
        Ces questions viennent d&apos;étudiants qui ont raconté leur oral, anonymement, et ont été relues avant publication. Les tiennes tomberont peut-être ailleurs — mais tu sauras à quoi ressemble un vrai jury. Tu veux t&apos;y entraîner ? <Link href="/app/appel">L&apos;appel avec le jury IA</Link>.
      </p>
    </div>
  );
}
