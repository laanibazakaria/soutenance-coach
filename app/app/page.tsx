"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSessions } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";
import { TOUS_LES_MODULES, lireModulesActifs, sauverModulesActifs, resumerModules, type ModuleActif, type ResumeModule } from "@/lib/preferences";
import { pousserTout, surSynchronisation, signalerSynchronisation } from "@/lib/sync/client";
import { useToast } from "@/app/components/Toast";
import CarteQuotidien from "./components/CarteQuotidien";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function libelleMode(mode?: string): string {
  return mode === "entretien" ? "💼 Entretien" : mode === "pitch" ? "🚀 Pitch" : mode === "concours" ? "🏛️ Concours" : "🎓 Soutenance";
}

/** L'accueil : ce que tu prépares, où tu en es, quoi faire maintenant. */
export default function AccueilPage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [actifs, setActifs] = useState<ModuleActif[] | null | undefined>(undefined);
  const [choisir, setChoisir] = useState(false);
  const [resumes, setResumes] = useState<ResumeModule[]>([]);

  useEffect(() => {
    const lire = () => {
      const s = listSessions(window.localStorage);
      const a = lireModulesActifs(window.localStorage);
      setSessions(s);
      setActifs(a);
      setResumes(a ? resumerModules(window.localStorage, s, a) : []);
      setChoisir(new URLSearchParams(window.location.search).get("choisir") === "1");
    };
    lire();
    return surSynchronisation(lire);
  }, []);

  if (actifs === undefined || sessions === null) return null;

  function enregistrer(liste: ModuleActif[]) {
    sauverModulesActifs(window.localStorage, liste);
    setActifs(liste);
    setResumes(resumerModules(window.localStorage, sessions ?? [], liste));
    setChoisir(false);
    signalerSynchronisation();
    void pousserTout();
    window.history.replaceState(null, "", "/app");
  }

  if (!actifs || choisir) {
    return <Choix initial={actifs ?? []} premiereFois={!actifs} sansSessions={sessions.length === 0} onValider={enregistrer} onAnnuler={actifs ? () => setChoisir(false) : undefined} />;
  }

  const inactifs = TOUS_LES_MODULES.filter((m) => !actifs.includes(m.id));
  const recentes = sessions.slice(0, 3);
  const urgent = [...resumes].filter((r) => r.jours !== null && r.jours >= 0).sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0))[0];

  return (
    <div className="accueil">
      <CarteQuotidien />
      {urgent && (
        <div className="card accueil-prochaine">
          <div>
            <span className="parcours-sur">Prochaine échéance</span>
            <h2 className="parcours-titre">
              {urgent.emoji} {urgent.nom} · {urgent.jours === 0 ? "aujourd'hui" : urgent.jours === 1 ? "demain" : `dans ${urgent.jours} jours`}
            </h2>
            <p className="accueil-action">
              À faire maintenant : <Link href={urgent.prochaineAction.lien}>{urgent.prochaineAction.titre} →</Link>
            </p>
          </div>
          <div className={`jmoins ${(urgent.pourcent ?? 0) >= 80 ? "jmoins-pret" : (urgent.pourcent ?? 0) >= 40 ? "jmoins-encours" : "jmoins-debut"}`}>J-{urgent.jours}</div>
        </div>
      )}

      <div className="list-head">
        <h2 className="list-title">Mes oraux</h2>
        <button className="btn small" onClick={() => setChoisir(true)}>
          ＋ Ajouter ou retirer un oral
        </button>
      </div>
      <div className="accueil-grille">
        {resumes.map((r) => (
          <article key={r.id} className="card accueil-carte card-hover">
            <div className="accueil-carte-tete">
              <span className="accueil-emoji" aria-hidden="true">
                {r.emoji}
              </span>
              <div>
                <h3>{r.nom}</h3>
                <p className="session-meta">{r.sousTitre}</p>
              </div>
              {r.jours !== null && r.jours >= 0 && <span className="accueil-jours">J-{r.jours}</span>}
            </div>
            {r.pourcent !== null ? (
              <>
                <div className="jauge">
                  <div className={`jauge-barre ${r.pourcent >= 80 ? "jauge-pret" : r.pourcent >= 40 ? "jauge-encours" : "jauge-debut"}`} style={{ width: `${r.pourcent}%` }} />
                </div>
                <p className="jauge-texte" style={{ marginBottom: 10 }}>
                  <b>Prêt à {r.pourcent} %</b>
                </p>
              </>
            ) : (
              <p className="accueil-vide">Pas encore commencé.</p>
            )}
            <Link href={r.prochaineAction.lien} className="btn small primary">
              {r.prochaineAction.titre} →
            </Link>
            <Link href={r.hub} className="accueil-lien-hub">
              Ouvrir le module
            </Link>
          </article>
        ))}
      </div>

      <div className="list-head">
        <h2 className="list-title">Dernières sessions</h2>
        <div className="list-actions">
          <Link href="/app/bilan" className="btn small">
            📄 Mon bilan
          </Link>
          <Link href="/app/sessions" className="btn small">
            Tout l&apos;historique
          </Link>
          <Link href="/app/session" className="btn small primary">
            🎤 Nouvelle session
          </Link>
        </div>
      </div>
      {recentes.length === 0 ? (
        <div className="card teaser">
          Aucune session encore. <Link href="/app/session">Lance ta première</Link> — deux minutes suffisent.
          {" "}Ou <a href="/demo-capture.html?vers=/app">regarde avec un exemple</a> ce que l&apos;application donne une fois remplie.
        </div>
      ) : (
        recentes.map((s) => (
          <Link key={s.id} href="/app/sessions" className="card session-row accueil-session">
            <div>
              <div className="session-meta">
                {formatDate(s.startedAt)} · {Math.round(s.durationMs / 60000)} min · {libelleMode(s.mode)}
              </div>
              <div className="session-excerpt">{s.transcript || "(transcription vide)"}</div>
            </div>
          </Link>
        ))
      )}

      {inactifs.length > 0 && (
        <>
          <h2 className="list-title" style={{ marginTop: 30 }}>
            Découvrir
          </h2>
          <div className="accueil-grille">
            {inactifs.map((m) => (
              <article key={m.id} className="card accueil-carte accueil-carte-decouvrir">
                <div className="accueil-carte-tete">
                  <span className="accueil-emoji" aria-hidden="true">
                    {m.emoji}
                  </span>
                  <div>
                    <h3>{m.nom}</h3>
                    <p className="session-meta">{m.description}</p>
                  </div>
                </div>
                <button className="btn small" onClick={() => enregistrer([...actifs, m.id])}>
                  Activer
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Choix({
  initial,
  premiereFois,
  sansSessions,
  onValider,
  onAnnuler,
}: {
  initial: ModuleActif[];
  premiereFois: boolean;
  sansSessions: boolean;
  onValider: (l: ModuleActif[]) => void;
  onAnnuler?: () => void;
}) {
  const [choix, setChoix] = useState<ModuleActif[]>(initial.length ? initial : []);
  const toast = useToast();
  function basculer(id: ModuleActif) {
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }
  return (
    <div className="choix">
      <h2 className="onboarding-title">{premiereFois ? "Qu'est-ce que tu prépares ?" : "Tes oraux"}</h2>
      <p className="onboarding-lead">
        {premiereFois
          ? "Choisis un ou plusieurs oraux : l'application ne te montrera que ce qui te concerne. Tu pourras en ajouter plus tard."
          : "Ajoute ou retire un oral. Rien n'est supprimé : un module retiré garde ses données."}
      </p>
      <div className="choix-grille">
        {TOUS_LES_MODULES.map((m) => {
          const actif = choix.includes(m.id);
          return (
            <button key={m.id} type="button" className={`card choix-carte${actif ? " active" : ""}`} onClick={() => basculer(m.id)} aria-pressed={actif}>
              <span className="accueil-emoji" aria-hidden="true">
                {m.emoji}
              </span>
              <b>{m.nom}</b>
              <p>{m.description}</p>
              <span className="choix-coche" aria-hidden="true">
                {actif ? "✓" : "+"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="actions">
        {onAnnuler && (
          <button className="btn" onClick={onAnnuler}>
            Annuler
          </button>
        )}
        <button
          className="btn primary big"
          disabled={choix.length === 0}
          onClick={() => {
            if (choix.length === 0) {
              toast.info("Choisis au moins un oral.");
              return;
            }
            onValider(choix);
          }}
        >
          {premiereFois ? "C'est parti" : "Enregistrer"}
        </button>
      </div>
      {premiereFois && sansSessions && (
        <p className="onboarding-alt">
          Tu veux d&apos;abord voir à quoi ça ressemble ? <a href="/demo-capture.html?vers=/app">Ouvrir avec un exemple</a>
        </p>
      )}
    </div>
  );
}
