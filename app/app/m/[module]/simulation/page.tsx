"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEnregistrement } from "../../../hooks/useEnregistrement";
import { MODULES, estModuleId, questionsClassiquesModule, type ModuleOral, type ProfilModule } from "@/lib/modules";
import { lireProfil, marquerEtapeModule, cleQuestionsModule } from "@/lib/modules/persistance";
import { LIBELLES_CATEGORIES_ENTRETIEN, type QuestionEntretien } from "@/lib/entretien";
import { analyserReponse, type AvisModele } from "@/lib/jury/evaluation";
import { lireCache } from "@/lib/ia-cache";
import { pousserTout } from "@/lib/sync/client";

type Etape = "attente" | "reponse" | "evaluation";

export default function SimulationModulePage() {
  const params = useParams<{ module: string }>();
  const id = params.module;
  if (!estModuleId(id)) {
    return (
      <div className="empty">
        Ce module n&apos;existe pas. <Link href="/app">Retour au parcours →</Link>
      </div>
    );
  }
  return <Simulation m={MODULES[id]} />;
}

/** Simulation générique : le jury du module pose, tu réponds au micro, il relance. */
function Simulation({ m }: { m: ModuleOral }) {
  const rec = useEnregistrement();
  const [profil, setProfil] = useState<ProfilModule | null | undefined>(undefined);
  const [questions, setQuestions] = useState<QuestionEntretien[]>([]);
  const [index, setIndex] = useState(0);
  const [etape, setEtape] = useState<Etape>("attente");
  const [avis, setAvis] = useState<AvisModele | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState(false);
  const [reponseFinale, setReponseFinale] = useState("");
  const questionAfficheeRef = useRef(0);

  useEffect(() => {
    const p = lireProfil(window.localStorage, m.id);
    setProfil(p);
    const ia = p ? lireCache<QuestionEntretien[]>(window.localStorage, cleQuestionsModule(p)) : null;
    const classiques = questionsClassiquesModule(m);
    setQuestions(ia ? [...ia, ...classiques].slice(0, 16) : classiques);
  }, [m]);

  const question = questions[index];

  async function demarrer() {
    setAvis(null);
    setErreurIA(null);
    setReponseFinale("");
    questionAfficheeRef.current = Date.now();
    if (await rec.start()) setEtape("reponse");
  }

  async function terminer() {
    rec.stop();
    const reponse = rec.transcript();
    setReponseFinale(reponse);
    setEtape("evaluation");
    if (!reponse || !question) return;
    marquerEtapeModule(window.localStorage, m.id, "simulation", true);
    void pousserTout();
    setEvaluation(true);
    try {
      const res = await fetch("/api/modules/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          module: m.id,
          question,
          reponse,
          latenceMs: Date.now() - questionAfficheeRef.current,
          profil: profil ? { champs: profil.champs, documentTexte: profil.documentTexte } : undefined,
        }),
      });
      const data = (await res.json()) as { avis?: AvisModele; erreur?: string };
      if (res.ok && data.avis) setAvis(data.avis);
      else setErreurIA(data.erreur ?? "L'avis n'a pas pu être obtenu.");
    } catch {
      setErreurIA("L'avis du jury n'est pas disponible — les mesures ci-dessous, elles, sont calculées localement.");
    } finally {
      setEvaluation(false);
    }
  }

  function suivante() {
    setIndex((i) => (i + 1) % Math.max(1, questions.length));
    setEtape("attente");
    setAvis(null);
    setErreurIA(null);
    setReponseFinale("");
  }

  if (profil === undefined) return null;
  const analyse = etape === "evaluation" && reponseFinale ? analyserReponse(reponseFinale) : null;

  return (
    <>
      <div className="toolbar">
        <div className="session-meta">{m.persona} · {profil ? "questions sur ton dossier" : "questions classiques"}</div>
        <Link href={`/app/m/${m.id}`} className="btn small">
          Mon profil
        </Link>
      </div>
      {!profil && (
        <div className="card jury-intro">
          <b>Simulation générique.</b>
          <p>
            <Link href={`/app/m/${m.id}`}>Décris ton projet et dépose ton dossier</Link> : le jury posera des questions sur <i>ton</i> projet et jugera tes réponses par rapport à <i>ton</i> dossier.
          </p>
        </div>
      )}
      {!rec.supported && (
        <div className="warn" role="alert">
          La reconnaissance vocale n&apos;est pas disponible dans ce navigateur. Utilise Chrome ou Edge.
        </div>
      )}
      {rec.error && (
        <div className="warn" role="alert">
          {rec.error}
        </div>
      )}
      {question && (
        <>
          <div className="jury-progress">
            Question {index + 1} sur {questions.length} · {question.source === "ia" ? "tirée de ton dossier" : "classique"}
          </div>
          <article className="card question-posee">
            <span className="question-cat">{LIBELLES_CATEGORIES_ENTRETIEN[question.categorie]} · {m.persona}</span>
            <p className="question-grande">{question.question}</p>
            {etape !== "attente" && (
              <>
                <p className="question-pourquoi">💡 {question.pourquoi}</p>
                <p className="question-pourquoi">
                  <b>Une bonne réponse :</b> {question.attendu}
                </p>
              </>
            )}
          </article>
          {etape === "attente" && (
            <div className="actions">
              <button className="btn primary big" onClick={() => void demarrer()} disabled={!rec.supported}>
                🎤 Répondre maintenant
              </button>
              <button className="btn" onClick={suivante}>
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
                {rec.finalText === "" && rec.interimText === "" ? (
                  <span className="transcript-placeholder">Ta réponse s&apos;affichera ici…</span>
                ) : (
                  <>
                    {rec.finalText}
                    <span className="interim">{rec.interimText}</span>
                  </>
                )}
              </div>
              <div className="actions">
                <button className="btn primary" onClick={() => void terminer()}>
                  ■ J&apos;ai terminé ma réponse
                </button>
              </div>
            </>
          )}
          {etape === "evaluation" && (
            <>
              <div className="transcript">{reponseFinale || "(aucune réponse captée)"}</div>
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
              {evaluation && <div className="card jury-loading">Le jury prend ses notes…</div>}
              {erreurIA && !evaluation && (
                <div className="card jury-degrade">
                  <b>Avis indisponible</b>
                  <p>{erreurIA}</p>
                </div>
              )}
              {avis && (
                <div className="avis">
                  <h2 className="list-title">L&apos;avis du {m.persona.toLowerCase()}</h2>
                  <article className="card avis-bloc avis-forts">
                    <b>Ce qui fonctionne</b>
                    <ul>
                      {avis.points_forts.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="card avis-bloc avis-faibles">
                    <b>Ce qu&apos;il relèverait</b>
                    <ul>
                      {avis.points_faibles.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="card avis-bloc">
                    <b>Ce qu&apos;il espérait entendre</b>
                    <p>{avis.attendu}</p>
                  </article>
                  <article className="card avis-bloc avis-relance">
                    <b>Sa relance</b>
                    <p>« {avis.relance} »</p>
                  </article>
                </div>
              )}
              <div className="actions">
                <button className="btn primary" onClick={suivante}>
                  Question suivante →
                </button>
                <button className="btn" onClick={() => void demarrer()}>
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
