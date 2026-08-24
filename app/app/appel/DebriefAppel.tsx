"use client";

import Link from "next/link";
import { Icone, IconeBadge } from "@/app/components/Icone";
import { membreParId, type Debrief, type Message, type Persona } from "@/lib/appel";
import type { BilanCamera } from "@/lib/camera";
import ConstatsCamera from "@/app/components/ConstatsCamera";
import GrilleVue from "@/app/components/GrilleVue";
import type { Evaluation } from "@/lib/grille";

/**
 * Le débrief après l'appel : le diagnostic, ce qui a marché (avec tes mots),
 * les moments manqués, le plan d'action — et l'échange complet. Aucune note.
 */
export default function DebriefAppel({
  phase,
  debrief,
  erreur,
  historique,
  persona,
  dureeS,
  sessionId,
  camera = null,
  grille = null,
  onRecommencer,
}: {
  phase: "debrief" | "fini";
  debrief: Debrief | null;
  erreur: string | null;
  historique: Message[];
  persona: Persona;
  dureeS: number;
  sessionId: string | null;
  camera?: BilanCamera | null;
  grille?: Evaluation | null;
  onRecommencer: () => void;
}) {
  const minutes = Math.round(dureeS / 60);
  const nbQuestions = historique.filter((m) => m.role === "assistant").length;
  return (
    <div className="appel-debrief">
      <div className="card appel-resume">
        <IconeBadge nom="valide" teinte="vert" taille={48} rond />
        <div>
          <h2>Appel terminé</h2>
          <p className="session-meta">
            {persona.nom} · {minutes} min · {nbQuestions} question{nbQuestions > 1 ? "s" : ""}
            {sessionId && (
              <>
                {" "}· <Link href="/app/sessions">enregistré dans tes sessions</Link>
              </>
            )}
          </p>
        </div>
      </div>

      {grille && <GrilleVue evaluation={grille} />}

      {phase === "debrief" && (
        <div className="card teaser" aria-busy="true">
          <Icone nom="message" /> Le coach relit l&apos;échange… (10 à 30 secondes)
        </div>
      )}
      {phase === "fini" && !debrief && (
        <div className="warn" role="alert">
          {erreur ?? "Le débrief n'a pas pu être produit."} L&apos;échange est conservé ci-dessous.
        </div>
      )}

      {debrief && (
        <>
          <section className="card appel-diagnostic">
            <span className="carte-titre carte-titre-clair">
              <Icone nom="eclair" taille={16} /> Diagnostic
            </span>
            <p>{debrief.diagnostic}</p>
          </section>

          {debrief.bienFait.length > 0 && (
            <section className="appel-section">
              <h3 className="list-title">
                <Icone nom="valide" taille={18} /> Ce qui a marché
              </h3>
              {debrief.bienFait.map((b, i) => (
                <article key={i} className="card appel-carte appel-carte-vert">
                  <b>{b.point}</b>
                  {b.citation && <blockquote>« {b.citation} »</blockquote>}
                  {b.pourquoi && <p>{b.pourquoi}</p>}
                </article>
              ))}
            </section>
          )}

          {debrief.momentsManques.length > 0 && (
            <section className="appel-section">
              <h3 className="list-title">
                <Icone nom="alerte" taille={18} /> Les moments manqués
              </h3>
              {debrief.momentsManques.map((m, i) => (
                <article key={i} className="card appel-carte appel-carte-or">
                  <b>{m.question}</b>
                  {m.ceQueTuAsDit && (
                    <p className="appel-dit">
                      <span>Tu as dit :</span> {m.ceQueTuAsDit}
                    </p>
                  )}
                  {m.mieux && (
                    <p className="appel-mieux">
                      <span>Mieux :</span> {m.mieux}
                    </p>
                  )}
                </article>
              ))}
            </section>
          )}

          {debrief.planAction.length > 0 && (
            <section className="card appel-plan">
              <h3 className="list-title" style={{ margin: "0 0 12px" }}>
                <Icone nom="fleche" taille={18} /> Plan d&apos;action pour la prochaine fois
              </h3>
              <ol>
                {debrief.planAction.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {camera && <ConstatsCamera bilan={camera} />}

      <details className="classiques">
        <summary>L&apos;échange complet ({historique.length} répliques)</summary>
        <div className="appel-dialogue appel-dialogue-complet">
          {historique.map((m, i) => (
            <p key={i} className={`appel-bulle appel-bulle-${m.role}`}>
              {m.role === "assistant" && m.membre && <span className="appel-qui">{membreParId(persona.mode, m.membre).nom}</span>}
              {m.content}
            </p>
          ))}
        </div>
      </details>

      <div className="actions" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={onRecommencer}>
          <Icone nom="micro" /> Refaire un appel
        </button>
        <Link href="/app/sessions" className="btn">
          Mes sessions
        </Link>
      </div>
    </div>
  );
}
