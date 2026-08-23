"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionRecord } from "@/lib/types";
import type { AvisCoach as Avis } from "@/lib/coach";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCandidature } from "@/lib/entretien/persistance";
import { MODULES, estModuleId, contexteProfil } from "@/lib/modules";
import { lireProfil } from "@/lib/modules/persistance";
import { pousserTout } from "@/lib/sync/client";
import { lireLangue, courte } from "@/lib/langue";
import { Icone } from "@/app/components/Icone";

/** Clé de cache d'un avis : une session, un avis — on ne redemande pas. */
export function cleAvisCoach(sessionId: string): string {
  return `coach:${sessionId}`;
}

interface Props {
  session: SessionRecord;
  /** Dans l'historique : bouton discret, bloc replié. */
  compact?: boolean;
  /** À la fin d'une session : l'avis part tout seul, comme chez Propulsez. */
  auto?: boolean;
}

/**
 * L'avis du coach sur une session : oublis par rapport au support, passages
 * confus, reformulations, points forts, priorité. Automatique à la fin d'une
 * session qui a de la matière (comme Propulsez), sur bouton dans l'historique ;
 * mis en cache par session, synchronisé avec les autres résultats IA.
 */
export default function AvisCoach({ session, compact = false, auto = false }: Props) {
  const [avis, setAvis] = useState<Avis | null>(null);
  const [etat, setEtat] = useState<"idle" | "chargement" | "erreur">("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(!compact);
  const [supportConnu, setSupportConnu] = useState(false);

  useEffect(() => {
    setAvis(lireCache<Avis>(window.localStorage, cleAvisCoach(session.id)));
    setSupportConnu(listeDeckSauvegarde(window.localStorage) !== null);
  }, [session.id]);

  // Analyse automatique : une fois par session, seulement si elle a de la matière
  // (inutile de dépenser un appel IA sur trois phrases).
  const autoLance = useRef<string | null>(null);
  useEffect(() => {
    if (!auto || autoLance.current === session.id) return;
    if (session.wordCount < 40 || session.durationMs < 30_000) return;
    if (lireCache<Avis>(window.localStorage, cleAvisCoach(session.id)) !== null) return;
    autoLance.current = session.id;
    void demander();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, session.id]);

  async function demander() {
    setEtat("chargement");
    setErreur(null);
    const deck = listeDeckSauvegarde(window.localStorage);
    const candidature = session.mode === "entretien" ? lireCandidature(window.localStorage) : null;
    const module = estModuleId(session.mode) ? MODULES[session.mode] : null;
    const profil = module ? lireProfil(window.localStorage, module.id) : null;
    const dossier = module && profil ? { nom: module.nom, persona: module.persona, consigne: module.formatConsigne, contexte: contexteProfil(module, profil) } : undefined;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: session.transcript,
          durationMs: session.durationMs,
          targetDurationMs: session.targetDurationMs,
          slides: candidature || dossier ? undefined : deck?.slides.map((s) => ({ numero: s.numero, titre: s.titre, texte: s.texte })),
          slidesTiming: session.slides,
          candidature: candidature
            ? { poste: candidature.poste, entreprise: candidature.entreprise, offre: candidature.offre, cvTexte: candidature.cvTexte }
            : undefined,
          dossier,
          langue: courte(lireLangue(window.localStorage)),
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
            {etat === "chargement" ? "Le coach relit ta répétition…" : <><Icone nom="message" /> Demander l'avis du coach</>}
          </button>
          {!compact && (
            <p className="coach-note">
              {session.mode === "entretien"
                ? "Il compare ton pitch à ton CV et à l'offre : expériences pertinentes oubliées, exigences non adressées, phrases à reformuler."
                : estModuleId(session.mode)
                  ? "Il compare ta présentation à ton dossier et à la structure attendue : blocs manquants, preuves oubliées, phrases à reformuler."
                  : `Il compare ce que tu as dit ${supportConnu ? "à tes diapositives" : "à ce qu'attend un jury"} : oublis, passages confus, phrases à reformuler.`}{" "}
              Il ne note pas — les chiffres ci-dessus restent calculés par du code.
              {!session.mode && !supportConnu && " Dépose tes slides pour qu'il repère aussi les oublis."}
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
              <Icone nom="message" /> Avis du coach {ouvert ? "▾" : "▸"}
            </button>
          )}
          {ouvert && (
            <div className="avis coach-avis">
              <div className="card avis-bloc coach-priorite">
                <b><Icone nom="cible" /> Priorité avant la prochaine répétition</b>
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
