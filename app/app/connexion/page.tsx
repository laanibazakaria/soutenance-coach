"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

/**
 * Page de connexion. Le compte est optionnel : on le dit, et on dit ce qu'il
 * apporte et ce qu'il implique, avant de demander quoi que ce soit.
 */
export default function ConnexionPage() {
  const { status } = useSession();
  const [dispo, setDispo] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, unknown>) => setDispo(Boolean(p && p.google)))
      .catch(() => setDispo(false));
  }, []);

  return (
    <div className="connexion">
      <h1>Un compte, pour retrouver ton travail partout</h1>
      <p className="subtitle">
        Sans compte, tout reste dans ce navigateur — et ça marche très bien. Avec un compte, tes
        sessions, ton support et ton pitch te suivent sur ton téléphone, ton PC, celui de la fac.
      </p>

      {status === "authenticated" ? (
        <div className="card">
          Tu es déjà connecté. <Link href="/app">Retour à mes sessions →</Link>
        </div>
      ) : dispo === false ? (
        <div className="card jury-degrade">
          <b>La connexion n&apos;est pas encore activée sur ce déploiement.</b>
          <p>Tout le reste fonctionne sans compte, en local.</p>
        </div>
      ) : (
        <div className="actions">
          <button
            className="btn primary big"
            disabled={dispo === null}
            onClick={() => void signIn("google", { callbackUrl: "/app" })}
          >
            Continuer avec Google
          </button>
        </div>
      )}

      <div className="reassure">
        <p>
          🔒 <b>Ce qui est stocké sur ton compte :</b> les transcriptions de tes sessions, le texte
          de tes slides, ton pitch et tes questions. <b>Jamais l&apos;audio</b>, jamais le PDF.
        </p>
        <p>
          🗑️ <b>Tu peux tout supprimer</b> à tout moment, session par session. Rien n&apos;est
          utilisé pour entraîner un modèle.
        </p>
        <p>
          ↔️ <b>Ce que tu as déjà fait sans compte</b> sera fusionné avec ton compte à la première
          connexion — rien n&apos;est perdu.
        </p>
      </div>
    </div>
  );
}
