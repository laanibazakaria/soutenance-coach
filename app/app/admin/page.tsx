"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  mois: string;
  utilisateurs: { total: number; nouveaux7j: number };
  sessions: { total: number; derniers7j: number; parModule: Record<string, number> };
  supports: number;
  candidatures: number;
  profils: Record<string, number>;
  ia: { appelsMois: number; appelants: number; comptes: number; anonymes: number; top: { type: string; appels: number }[] };
  listeAttentePro: number;
  recents: { nom: string | null; email: string; inscrit: string; sessions: number }[];
}

interface RetourAdmin {
  id: string;
  type: string;
  ecole: string;
  filiere: string;
  niveau: string;
  annee: number;
  questions: string[];
  ressenti: string | null;
  conseil: string | null;
  approuve: boolean;
  creeLe: string;
}

function Moderation() {
  const [retours, setRetours] = useState<RetourAdmin[] | null>(null);
  const charger = () =>
    fetch("/api/admin/retours", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { retours: RetourAdmin[] }).retours : []))
      .then(setRetours)
      .catch(() => setRetours([]));
  useEffect(() => {
    void charger();
  }, []);
  async function agir(id: string, action: "approuver" | "retirer" | "supprimer") {
    if (action === "supprimer") await fetch("/api/admin/retours", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    else await fetch("/api/admin/retours", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, approuve: action === "approuver" }) });
    void charger();
  }
  if (!retours) return null;
  const attente = retours.filter((r) => !r.approuve);
  return (
    <>
      <h2 className="list-title">Retours d&apos;oral à relire ({attente.length} en attente · {retours.length - attente.length} publiés)</h2>
      {retours.length === 0 && <div className="card teaser">Aucun retour pour l&apos;instant.</div>}
      {retours.map((r) => (
        <article key={r.id} className={`card question${r.approuve ? "" : " question-priorite"}`}>
          <span className="question-cat">
            {r.type} · {r.ecole} · {r.filiere} · {r.niveau} · {r.annee} · {r.approuve ? "publié" : "en attente"}
          </span>
          <ol className="reelles-liste">
            {r.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
          {(r.ressenti || r.conseil) && <p className="session-meta">{[r.ressenti, r.conseil].filter(Boolean).join(" — ")}</p>}
          <div className="actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
            {r.approuve ? (
              <button className="btn small" onClick={() => void agir(r.id, "retirer")}>Retirer</button>
            ) : (
              <button className="btn small primary" onClick={() => void agir(r.id, "approuver")}>Publier</button>
            )}
            <button className="btn small danger" onClick={() => void agir(r.id, "supprimer")}>Supprimer</button>
          </div>
        </article>
      ))}
    </>
  );
}

/** Tableau de bord admin : l'usage réel, sans aucune transcription. */
export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null | "refuse">(null);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as Stats) : "refuse"))
      .then(setStats)
      .catch(() => setStats("refuse"));
  }, []);

  if (stats === null) return <div className="card teaser">Chargement…</div>;
  if (stats === "refuse")
    return (
      <div className="card teaser">
        Page réservée à l&apos;administrateur. <Link href="/app">Retour à l&apos;accueil →</Link>
      </div>
    );

  const kpi = (label: string, valeur: string | number, detail?: string) => (
    <div className="card kpi" key={label}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-valeur">{valeur}</span>
      {detail && <span className="session-meta">{detail}</span>}
    </div>
  );

  return (
    <div className="admin">
      <div className="kpi-grille">
        {kpi("Utilisateurs", stats.utilisateurs.total, `+${stats.utilisateurs.nouveaux7j} ces 7 jours`)}
        {kpi("Sessions synchronisées", stats.sessions.total, `+${stats.sessions.derniers7j} ces 7 jours`)}
        {kpi(`Appels IA · ${stats.mois}`, stats.ia.appelsMois, `${stats.ia.comptes} comptes, ${stats.ia.anonymes} anonymes`)}
        {kpi("Liste d'attente Pro", stats.listeAttentePro)}
        {kpi("Supports déposés", stats.supports)}
        {kpi("Candidatures (entretien)", stats.candidatures)}
        {kpi("Profils pitch", stats.profils.pitch ?? 0)}
        {kpi("Profils concours", stats.profils.concours ?? 0)}
      </div>

      <h2 className="list-title">Sessions par module</h2>
      <div className="chips" style={{ marginBottom: 24 }}>
        {Object.entries(stats.sessions.parModule).map(([m, n]) => (
          <span key={m} className="chip chip-info">
            {m} : {n}
          </span>
        ))}
      </div>

      <h2 className="list-title">Plus gros appelants IA ce mois</h2>
      <div className="timeline" style={{ marginBottom: 24 }}>
        {stats.ia.top.length === 0 ? (
          <div className="timeline-row">Aucun appel ce mois.</div>
        ) : (
          stats.ia.top.map((t, i) => (
            <div key={i} className="timeline-row">
              <span className="timeline-num">{i + 1}</span>
              <span className="timeline-titre">{t.type}</span>
              <span className="timeline-temps">{t.appels} appels</span>
            </div>
          ))
        )}
      </div>

      <h2 className="list-title">Dernières inscriptions</h2>
      <div className="timeline">
        {stats.recents.map((u) => (
          <div key={u.email} className="timeline-row">
            <span className="timeline-titre">
              {u.nom ?? "—"} <span className="session-meta">· {u.email}</span>
            </span>
            <span className="session-meta">{new Date(u.inscrit).toLocaleDateString("fr-FR")}</span>
            <span className="timeline-temps">{u.sessions} sessions</span>
          </div>
        ))}
      </div>
      <p className="report-note" style={{ marginTop: 16 }}>Aucune transcription, aucun document n&apos;est lisible ici — seulement des comptes.</p>
      <Moderation />
    </div>
  );
}
