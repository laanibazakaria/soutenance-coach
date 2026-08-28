"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icone, IconeBadge } from "@/app/components/Icone";
import EtatVide from "@/app/components/EtatVide";
import { surSynchronisation } from "@/lib/sync/client";
import { construireRevision, type Revision, type QuestionRevue } from "@/lib/revision";

export const dynamic = "force-static";

const quand = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

function Carte({ q, ton }: { q: QuestionRevue; ton: "ratee" | "solide" | "posee" }) {
  return (
    <article className={`revision-carte revision-${ton}`}>
      <p className="revision-question">{q.question}</p>
      {q.tuAsDit && (
        <p className="revision-detail">
          <em>{ton === "solide" ? "Tu as dit" : "Tu avais dit"}</em> « {q.tuAsDit} »
        </p>
      )}
      {q.mieux && (
        <p className="revision-detail revision-mieux">
          <em>{ton === "ratee" ? "Une bonne réponse contenait" : "Pourquoi ça a marché"}</em> {q.mieux}
        </p>
      )}
      <small className="revision-quand">
        {q.mode === "entretien" ? "Entretien" : "Soutenance"} · {quand(q.date)}
      </small>
    </article>
  );
}

/**
 * Tout revoir : l'historique rangé par question, pas par séance. C'est la
 * page qu'on ouvre dans le métro la veille — les ratées d'abord, avec ce
 * qu'il fallait dire, puis les acquis, puis tout le reste.
 */
export default function RevisionPage() {
  const [revision, setRevision] = useState<Revision | null>(null);

  useEffect(() => {
    const lire = () => setRevision(construireRevision(window.localStorage));
    lire();
    return surSynchronisation(lire);
  }, []);

  if (!revision) return null;

  const rien = revision.nbSeances === 0;
  if (rien) {
    return (
      <EtatVide
        icone="fiches"
        titre="Rien à revoir pour l'instant"
        texte="Chaque question que le jury te posera viendra se ranger ici — les ratées avec la bonne réponse, les réussies pour l'assurance. C'est la page qu'on relit la veille."
        action={{ libelle: "Passer mon premier appel →", href: "/app/appel" }}
      />
    );
  }

  const { aRetravailler, solides, posees } = revision;

  return (
    <div className="revision">
      <div className="toolbar">
        <p className="session-meta">
          {revision.nbSeances} séance{revision.nbSeances > 1 ? "s" : ""} ·{" "}
          {aRetravailler.length + solides.length + posees.length} questions rangées — les plus
          récentes d&apos;abord.
        </p>
        <div className="list-actions">
          <button className="btn small" onClick={() => window.print()}>
            <Icone nom="imprimer" /> Imprimer
          </button>
          <Link href="/app/appel" className="btn small primary">
            <Icone nom="appel" /> Repasser un appel
          </Link>
        </div>
      </div>

      {aRetravailler.length > 0 && (
        <section aria-label="À retravailler">
          <h2 className="list-title">
            <IconeBadge nom="alerte" teinte="or" taille={26} /> À retravailler — relis-les en boucle
          </h2>
          <p className="report-note a-gauche" style={{ marginTop: 0 }}>
            Les questions restées sans bonne réponse, avec ce qu&apos;elle aurait contenu. Le jury
            s&apos;en souvient : il rouvrira sur la première.
          </p>
          {aRetravailler.map((q, i) => (
            <Carte key={i} q={q} ton="ratee" />
          ))}
        </section>
      )}

      {solides.length > 0 && (
        <section aria-label="Déjà solide">
          <h2 className="list-title">
            <IconeBadge nom="valide" teinte="vert" taille={26} /> Déjà solide — l&apos;assurance
            qu&apos;on emporte
          </h2>
          {solides.map((q, i) => (
            <Carte key={i} q={q} ton="solide" />
          ))}
        </section>
      )}

      {posees.length > 0 && (
        <section aria-label="Toutes les questions posées">
          <h2 className="list-title">
            <IconeBadge nom="parole" taille={26} /> Tout ce qu&apos;on t&apos;a déjà demandé
          </h2>
          <p className="report-note a-gauche" style={{ marginTop: 0 }}>
            Le jury pioche toujours dans les mêmes eaux : une question déjà posée reviendra, à toi
            ou à quelqu&apos;un d&apos;autre.
          </p>
          {posees.map((q, i) => (
            <Carte key={i} q={q} ton="posee" />
          ))}
        </section>
      )}
    </div>
  );
}
