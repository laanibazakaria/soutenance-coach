"use client";

import { useEffect, useState } from "react";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { cleExemple, type Exemple } from "@/lib/jury/exemple";
import { lireLangue, courte } from "@/lib/langue";
import { pousserTout } from "@/lib/sync/client";

interface Props {
  question: string;
  pourquoi?: string;
  contexte?: string;
  persona: string;
  reponseEtudiant?: string;
}

/** « Voici comment un excellent candidat répondrait » — sur demande, mis en cache par question. */
export default function ExempleReponse({ question, pourquoi, contexte, persona, reponseEtudiant }: Props) {
  const [exemple, setExemple] = useState<Exemple | null>(null);
  const [etat, setEtat] = useState<"idle" | "chargement" | "erreur">("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = cleExemple(question, contexte);

  useEffect(() => {
    setExemple(lireCache<Exemple>(window.localStorage, cle));
    setEtat("idle");
  }, [cle]);

  async function demander() {
    setEtat("chargement");
    setErreur(null);
    try {
      const res = await fetch("/api/jury/exemple", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, pourquoi, contexte, persona, reponseEtudiant, langue: courte(lireLangue(window.localStorage)) }),
      });
      const data = (await res.json()) as { exemple?: Exemple; erreur?: string };
      if (res.ok && data.exemple) {
        ecrireCache(window.localStorage, cle, data.exemple);
        setExemple(data.exemple);
        setEtat("idle");
        void pousserTout();
      } else {
        setErreur(data.erreur ?? "L'exemple n'a pas pu être obtenu.");
        setEtat("erreur");
      }
    } catch {
      setErreur("Le serveur est injoignable.");
      setEtat("erreur");
    }
  }

  if (!exemple) {
    return (
      <div className="exemple-invite">
        <button className="btn" onClick={() => void demander()} disabled={etat === "chargement"}>
          {etat === "chargement" ? "Le coach rédige…" : "✨ Voir comment un excellent candidat répondrait"}
        </button>
        {erreur && (
          <p className="warn" role="alert" style={{ marginTop: 10 }}>
            {erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <article className="card avis-bloc exemple">
      <b>✨ Comment un excellent candidat répondrait</b>
      <p className="exemple-reponse">« {exemple.reponse} »</p>
      <ul className="exemple-pourquoi">
        {exemple.pourquoi.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {exemple.suppositions.length > 0 && (
        <p className="session-meta">
          À compléter avec tes vraies informations : {exemple.suppositions.join(" · ")}
        </p>
      )}
      <p className="report-note" style={{ textAlign: "left" }}>Un exemple sur ton dossier, pas un corrigé : dis-le avec tes mots, pas les siens.</p>
    </article>
  );
}
