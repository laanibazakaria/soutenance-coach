"use client";

import { useEffect, useState } from "react";
import type { SessionRecord } from "@/lib/types";
import type { AvisCoach as Avis } from "@/lib/coach";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { pousserTout } from "@/lib/sync/client";

/** Clé de cache d'un avis : une session, un avis — on ne redemande pas. */
export function cleAvisCoach(sessionId: string): string {
  return `coach:${sessionId}`;
}

interface Props {
  session: SessionRecord;
  /** Dans l'historique : bouton discret, bloc replié. */
  compact?: boolean;
}

/**
 * L'avis du coach sur une session : oublis par rapport au support, passages
 * confus, reformulations, points forts, priorité. Demandé explicitement
 * (jamais en arrière-plan), mis en cache par session, synchronisé avec les
 * autres résultats IA.
 */
export default function AvisCoach({ session, compact = false }: Props) {
  const [avis, setAvis] = useState<Avis | null>(null);
  const [etat, setEtat] = useState<"idle" | "chargement" | "erreur">("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(!compact);
  const [supportConnu, setSupportConnu] = useState(false);

  useEffect(() => {
    setAvis(lireCache<Avis>(window.localStorage, cleAvisCoach(session.id)));
    setSupportConnu(listeDeckSauvegarde(window.localStorage) !== null);
  }, [session.id]);

  async function demander() {
    setEtat("chargement");
    setErreur(null);
    const deck = listeDeckSauvegarde(window.localStorage);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: session.transcript,
          durationMs: session.durationMs,
          targetDurationMs: session.targetDurationMs,
          slides: deck?.slides.map((s) => ({ numero: s.numero, titre: s.titre, texte: s.texte })),
          slidesTiming: session.slides,
        }),
      });
      const data = (await res.json()) as { avis?: Avis; erreur?: string };
      if (res.ok && data.avis) {
        ecrireCache(window.localStorage, cleAvisCoach(session.id), data.avis);
        setAvis(data.avis);
        setEtat("idle");
        setOuvert(true);
        void pousserTout();
      } else {
        setErreur(data.erreur ?? "L'avis n'a pas pu être obtenu.");
        setEtat("erreur");
      }
    } catch {
      setErreur("Le serveur est injoignable. Tes mesures, elles, sont déjà calculées.");
      setEtat("erreur");
    }
  }

  if (session.transcript.trim() === "") return null;

  return (
    <div className={`coach${compact ? " coach-compact" : ""}`}>
      {!avis ? (
        <div className="coach-invite">
          <button className={`btn${compact ? " small" : " primary"}`} onClick={() => void demander()} disabled={etat === "chargement"}>
            {etat === "chargement" ? "Le coach relit ta répétition…" : "💬 Demander l'avis du coach"}
          </button>
          {!compact && (
            <p className="coach-note">
              Il compare ce que tu as dit {supportConnu ? "à tes diapositives" : "à ce qu'attend un jury"} : oublis, passages
              confus, phrases à reformuler. Il ne note pas — les chiffres ci-dessus restent calculés par du code.
              {!supportConnu && " Dépose tes slides pour qu'il repère aussi les oublis."}
            </p>
          )}
          {erreur && (
            <p className="warn coach-erreur" role="alert">
              {erreur}
            </p>
          )}
        </div>
      ) : (
        <>
          {compact && (
            <button className="link-btn coach-toggle" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
              💬 Avis du coach {ouvert ? "▾" : "▸"}
            </button>
          )}
          {ouvert && (
            <div className="avis coach-avis">
              <div className="card avis-bloc coach-priorite">
                <b>🎯 Priorité avant la prochaine répétition</b>
                <p>{avis.priorite}</p>
              </div>
              {avis.oublis.length > 0 && (
                <div className="card avis-bloc coach-oublis">
                  <b>Ce que tes diapositives disent et que tu n&apos;as pas dit</b>
                  <ul>
                    {avis.oublis.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {avis.confus.length > 0 && (
                <div className="card avis-bloc avis-faibles">
                  <b>Passages peu clairs</b>
                  <ul>
                    {avis.confus.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {avis.reformulations.length > 0 && (
                <div className="card avis-bloc coach-reformulations">
                  <b>À dire autrement</b>
                  <ul>
                    {avis.reformulations.map((r) => (
                      <li key={r.avant} className="coach-reformulation">
                        <span className="coach-avant">« {r.avant} »</span>
                        <span className="coach-apres">→ « {r.apres} »</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="card avis-bloc avis-forts">
                <b>Ce qui tient</b>
                <ul>
                  {avis.points_forts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <p className="report-note">Avis d&apos;un modèle de langage, demandé par toi. Il conseille, il ne note pas.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
