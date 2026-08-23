"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LIMITES_PAR_DEFAUT, type EtatQuota } from "@/lib/quota";
import { useToast } from "@/app/components/Toast";

/** Les forfaits : ce qui est gratuit aujourd'hui, ce que Pro apportera, la liste d'attente. */
export default function ForfaitsPage() {
  const { status, data } = useSession();
  const [etat, setEtat] = useState<EtatQuota | null>(null);
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [inscrit, setInscrit] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((e: EtatQuota | null) => e && setEtat(e))
      .catch(() => {});
    setInscrit(window.localStorage.getItem("sc.interet-pro") === "1");
  }, [status]);

  useEffect(() => {
    if (data?.user?.email && !email) setEmail(data.user.email);
  }, [data, email]);

  async function rejoindre(ev: React.FormEvent) {
    ev.preventDefault();
    setEnvoi(true);
    try {
      const res = await fetch("/api/interet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const j = (await res.json()) as { ok?: boolean; erreur?: string };
      if (res.ok && j.ok) {
        window.localStorage.setItem("sc.interet-pro", "1");
        setInscrit(true);
        toast.success("C'est noté — tu seras prévenu en premier.");
      } else toast.error(j.erreur ?? "L'inscription n'a pas abouti.");
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setEnvoi(false);
    }
  }

  const quand = etat ? new Date(etat.reinitialisation + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : null;

  return (
    <div className="forfaits">
      {etat && (
        <div className="card usage-carte">
          <div>
            <b>Tes appels IA ce mois</b>
            <p className="session-meta">
              {etat.appels} utilisés sur {etat.limite} ({etat.type === "anonyme" ? "sans compte" : "avec compte"}) · renouvellement le {quand}
            </p>
          </div>
          <div className="jauge" style={{ width: 220, margin: 0 }}>
            <div className={`jauge-barre ${etat.reste === 0 ? "jauge-debut" : etat.appels / etat.limite >= 0.75 ? "jauge-encours" : "jauge-pret"}`} style={{ width: `${Math.min(100, (etat.appels / Math.max(1, etat.limite)) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="forfaits-grille">
        <article className="card forfait">
          <span className="question-cat">Aujourd&apos;hui</span>
          <h2>Gratuit</h2>
          <p className="forfait-prix">0 €</p>
          <ul className="forfait-liste">
            <li>✓ Sessions, mesures, tendances, répétition avec slides — <b>illimités</b>, tout reste sur ton appareil</li>
            <li>✓ Les quatre modules et leurs guides, la soutenance blanche, la réécoute audio, le bilan, le calendrier</li>
            <li>
              ✓ <b>{LIMITES_PAR_DEFAUT.anonyme} appels IA</b> par mois sans compte, <b>{LIMITES_PAR_DEFAUT.compte}</b> avec un compte (pitch, questions, fiches, coach, jury)
            </li>
            <li>✓ Synchronisation entre appareils avec un compte Google</li>
            <li>✓ Suppression de tout, quand tu veux</li>
          </ul>
          {status !== "authenticated" && (
            <Link href="/app/connexion" className="btn primary">
              Créer mon compte — gratuit
            </Link>
          )}
        </article>

        <article className="card forfait forfait-pro">
          <span className="question-cat">Bientôt</span>
          <h2>Pro</h2>
          <p className="forfait-prix">
            quelques euros par mois <span className="session-meta">— le prix sera fixé avec les premiers inscrits</span>
          </p>
          <ul className="forfait-liste">
            <li>★ Appels IA largement étendus, pour préparer plusieurs oraux en même temps</li>
            <li>★ Le <b>mémoire ou la thèse</b> en entrée — les questions du rapporteur</li>
            <li>★ Plusieurs entretiens, plusieurs oraux en parallèle</li>
          </ul>
          {inscrit ? (
            <p className="forfait-ok">✓ Tu es sur la liste. Tu seras prévenu en premier, et tu auras le premier prix.</p>
          ) : (
            <form className="forfait-form" onSubmit={rejoindre}>
              <label className="champ champ-large">
                <span>Être prévenu au lancement</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" required />
              </label>
              <button className="btn primary" disabled={envoi}>
                {envoi ? "Envoi…" : "Me prévenir"}
              </button>
              <p className="report-note">Un seul e-mail, au lancement. Rien d&apos;autre.</p>
            </form>
          )}
        </article>
      </div>

      <p className="report-note" style={{ marginTop: 20 }}>
        Pourquoi des quotas ? L&apos;IA est fournie par un service externe avec un palier gratuit partagé entre tous. Les quotas garantissent que personne ne vide la réserve des autres. Tout ce qui ne passe pas par l&apos;IA reste illimité.
      </p>
    </div>
  );
}
