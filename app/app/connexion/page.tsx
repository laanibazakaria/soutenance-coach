"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { viderDonneesLocales } from "@/lib/sync/merge";
import { toutEffacerAudio } from "@/lib/audio/stockage";

/**
 * Page de connexion. Le compte est optionnel : on le dit, et on dit ce qu'il
 * apporte et ce qu'il implique, avant de demander quoi que ce soit.
 */
export default function ConnexionPage() {
  const { status, data: session } = useSession();
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const toast = useToast();

  async function supprimerCompte() {
    setSuppression(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      // Le compte n'existe plus : cet appareil ne doit rien garder non plus.
      viderDonneesLocales(window.localStorage);
      await toutEffacerAudio();
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("La suppression n'a pas abouti. Réessaie, ou écris-nous.");
      setSuppression(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, unknown>) => setDispo(Boolean(p && p.google)))
      .catch(() => setDispo(false));
  }, []);

  return (
    <div className="connexion">
      <p className="subtitle">
        Sans compte, tout reste dans ce navigateur — et ça marche très bien. Avec un compte, tes
        sessions, ton support, tes fiches et ton pitch te suivent sur ton téléphone, ton PC, celui de la fac.
      </p>

      {status === "authenticated" ? (
        <>
          <div className="card compte-carte">
            <div className="compte-identite">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="avatar avatar-grand" width={44} height={44} />
              ) : null}
              <div>
                <b>{session?.user?.name ?? "Connecté"}</b>
                <div className="session-meta">{session?.user?.email}</div>
              </div>
            </div>
            <p className="compte-note">
              Tes sessions, ton support, ton parcours et tes fiches sont synchronisés sur ce compte.{" "}
              <Link href="/app">Retour à l&apos;accueil →</Link>
            </p>
          </div>
          <div className="card compte-danger">
            <b>Supprimer mon compte</b>
            <p>
              Efface immédiatement et définitivement tout ce qui est rattaché à ton compte — identité Google, sessions,
              support, parcours, fiches, résultats IA — et vide cet appareil. Exporte tes sessions avant si elles comptent.
            </p>
            <button className="btn danger" onClick={() => setConfirmerSuppression(true)} disabled={suppression}>
              {suppression ? "Suppression…" : "Supprimer mon compte"}
            </button>
          </div>
          <ConfirmDialog
            ouverte={confirmerSuppression}
            onFermer={() => setConfirmerSuppression(false)}
            onConfirmer={() => void supprimerCompte()}
            titre="Supprimer définitivement ton compte ?"
            message="Tout sera effacé sur le serveur et sur cet appareil. Il n'y a pas de corbeille."
            libelleConfirmer="Oui, tout supprimer"
            danger
          />
        </>
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
        <p>
          🚪 <b>À la déconnexion, cet appareil est vidé</b> — ton travail reste sur ton compte.
          Sur un ordinateur partagé, la personne suivante ne voit rien de toi.
        </p>
        <p className="reassure-note">
          Le détail, sans jargon : <Link href="/confidentialite">politique de confidentialité</Link> ·{" "}
          <Link href="/mentions-legales">mentions légales</Link>.
        </p>
      </div>
    </div>
  );
}
