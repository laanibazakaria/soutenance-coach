"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { genererQuestions, selectionnerPourEntrainement, LIBELLES_CATEGORIES } from "@/lib/jury";
import { analyserReponse } from "@/lib/jury/evaluation";
import type { AvisModele } from "@/lib/jury/evaluation";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache } from "@/lib/ia-cache";
import { marquerEtape } from "@/lib/parcours/persistance";
import { surSynchronisation } from "@/lib/sync/client";
import { lireLangue, courte } from "@/lib/langue";
import ExempleReponse from "@/app/components/ExempleReponse";
import type { JuryQuestion } from "@/lib/slides/types";
import { Icone } from "@/app/components/Icone";

type Etape = "attente" | "reponse" | "evaluation";

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export default function JuryPage() {
  const [questions, setQuestions] = useState<JuryQuestion[]>([]);
  const [contexte, setContexte] = useState<string | undefined>();
  const [index, setIndex] = useState(0);
  const [etape, setEtape] = useState<Etape>("attente");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [avis, setAvis] = useState<AvisModele | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);
  const [evaluationEnCours, setEvaluationEnCours] = useState(false);
  const [supporte, setSupporte] = useState(true);

  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const stoppingRef = useRef(false);
  const questionAfficheeRef = useRef(0);

  // Incrémenté après chaque synchronisation : recharge support et questions.
  const [version, setVersion] = useState(0);
  useEffect(() => surSynchronisation(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    setSupporte(getRecognitionCtor() !== null);
    const deck = listeDeckSauvegarde(window.localStorage);
    // Priorité aux questions générées pour CE projet ; sinon la banque classique.
    const specifiques = lireCache<JuryQuestion[]>(window.localStorage, "questions-courantes");
    if (deck) {
      setContexte(deck.slides.map((s) => s.texte).join(" "));
      if (specifiques && specifiques.length >= 3) {
        const classiques = selectionnerPourEntrainement(genererQuestions(deck), 2);
        setQuestions([...specifiques, ...classiques]);
      } else {
        setQuestions(selectionnerPourEntrainement(genererQuestions(deck), 8));
      }
    } else {
      // Sans support chargé, on s'entraîne sur les questions universelles.
      setQuestions(
        selectionnerPourEntrainement(genererQuestions({ nomFichier: "", slides: [] }), 5),
      );
    }
    return () => {
      stoppingRef.current = true;
      recRef.current?.abort();
    };
  }, [version]);

  const question = questions[index];

  function demarrerReponse() {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !question) return;
    setTranscript("");
    setInterim("");
    setAvis(null);
    setErreurIA(null);
    finalRef.current = "";
    stoppingRef.current = false;
    questionAfficheeRef.current = Date.now();

    const rec = new Ctor();
    rec.lang = lireLangue(window.localStorage);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let partiel = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript + " ";
        else partiel += res[0].transcript;
      }
      setTranscript(finalRef.current);
      setInterim(partiel);
    };
    rec.onend = () => {
      if (!stoppingRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* déjà relancée */
        }
      }
    };
    recRef.current = rec;
    rec.start();
    setEtape("reponse");
  }

  async function terminerReponse() {
    stoppingRef.current = true;
    recRef.current?.stop();
    recRef.current = null;
    setInterim("");
    setEtape("evaluation");

    const reponse = finalRef.current.trim();
    if (reponse === "" || !question) return;

    setEvaluationEnCours(true);
    try {
      // Chemin absolu : depuis /app/jury, un chemin relatif résoudrait vers
      // /app/api/jury/evaluate, qui n'existe pas.
      // Répondre à voix haute à une question du jury : l'étape du parcours est faite.
      marquerEtape(window.localStorage, "jury", true);
      const res = await fetch("/api/jury/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          reponse,
          latenceMs: Date.now() - questionAfficheeRef.current,
          contexteSlides: contexte,
          langue: courte(lireLangue(window.localStorage)),
        }),
      });
      const data = await res.json();
      if (res.ok && data.avis) setAvis(data.avis as AvisModele);
      else setErreurIA(data.erreur ?? "L'avis n'a pas pu être obtenu.");
    } catch {
      setErreurIA(
        "L'avis du jury n'est pas disponible sur cette version — les mesures ci-dessous, elles, sont calculées localement.",
      );
    } finally {
      setEvaluationEnCours(false);
    }
  }

  function questionSuivante() {
    setIndex((i) => (i + 1) % questions.length);
    setEtape("attente");
    setTranscript("");
    setAvis(null);
    setErreurIA(null);
  }

  const analyse = etape === "evaluation" && transcript ? analyserReponse(transcript) : null;

  return (
    <>
      <div className="toolbar">
        <div />
        <Link href="/app/slides" className="btn small">
          <Icone nom="document" /> Mes slides
        </Link>
      </div>

      {!supporte && (
        <div className="warn" role="alert">
          La reconnaissance vocale n&apos;est pas disponible dans ce navigateur. Utilise Chrome ou
          Edge pour répondre à l&apos;oral.
        </div>
      )}

      {!question ? (
        <div className="empty">Chargement des questions…</div>
      ) : (
        <>
          <div className="jury-progress">
            Question {index + 1} sur {questions.length}
            {contexte ? (question?.id.startsWith("ia-") ? " · spécifique à ton projet" : " · basée sur tes slides") : " · questions générales"}
          </div>

          <article className="card question-posee">
            <span className="question-cat">{LIBELLES_CATEGORIES[question.categorie]}</span>
            <p className="question-grande">{question.question}</p>
            {etape !== "attente" && <p className="question-pourquoi"><Icone nom="idee" /> {question.pourquoi}</p>}
          </article>

          {etape === "attente" && (
            <div className="actions">
              <button className="btn primary big" onClick={demarrerReponse} disabled={!supporte}>
                <Icone nom="micro" /> Répondre maintenant
              </button>
              <button className="btn" onClick={questionSuivante}>
                Passer cette question
              </button>
            </div>
          )}

          {etape === "reponse" && (
            <>
              <div className="rec-banner">
                <span className="rec-dot" aria-hidden="true" /> Le jury t&apos;écoute…
              </div>
              <div className="transcript" aria-live="polite">
                {transcript === "" && interim === "" ? (
                  <span className="transcript-placeholder">Ta réponse s&apos;affichera ici…</span>
                ) : (
                  <>
                    {transcript}
                    <span className="interim">{interim}</span>
                  </>
                )}
              </div>
              <div className="actions">
                <button className="btn primary" onClick={terminerReponse}>
                  ■ J&apos;ai terminé ma réponse
                </button>
              </div>
            </>
          )}

          {etape === "evaluation" && (
            <>
              <div className="transcript">{transcript || "(aucune réponse captée)"}</div>

              {analyse && (
                <>
                  <h2 className="list-title">Ce qui est mesuré</h2>
                  <div className="report-grid">
                    {analyse.constats
                      .filter((c) => c.niveau !== "absent")
                      .map((c) => (
                        <article key={c.id} className={`metric metric-${c.niveau}`}>
                          <p className="metric-summary">{c.message}</p>
                        </article>
                      ))}
                  </div>
                </>
              )}

              {evaluationEnCours && (
                <div className="card jury-loading">Le jury rédige son retour…</div>
              )}

              {erreurIA && !evaluationEnCours && (
                <div className="card jury-degrade">
                  <b>Avis du jury indisponible</b>
                  <p>{erreurIA}</p>
                </div>
              )}

              {avis && (
                <div className="avis">
                  <h2 className="list-title">L&apos;avis du jury</h2>
                  <article className="card avis-bloc avis-forts">
                    <b>Ce qui fonctionne</b>
                    <ul>
                      {avis.points_forts.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="card avis-bloc avis-faibles">
                    <b>Ce qu&apos;un jury relèverait</b>
                    <ul>
                      {avis.points_faibles.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="card avis-bloc">
                    <b>Ce que le jury attendait</b>
                    <p>{avis.attendu}</p>
                  </article>
                  <article className="card avis-bloc avis-relance">
                    <b>La relance probable</b>
                    <p>« {avis.relance} »</p>
                  </article>
                </div>
              )}

              <ExempleReponse question={question.question} pourquoi={question.pourquoi} contexte={contexte} persona="Jury de soutenance" reponseEtudiant={transcript} />

              <div className="actions">
                <button className="btn primary" onClick={questionSuivante}>
                  Question suivante →
                </button>
                <button className="btn" onClick={demarrerReponse}>
                  Refaire cette réponse
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
