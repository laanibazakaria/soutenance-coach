"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { lireLangue, courte, type Langue } from "@/lib/langue";
import { useEnregistrement } from "../../hooks/useEnregistrement";
import { questionsClassiques, LIBELLES_CATEGORIES_ENTRETIEN, LIBELLES_ROLE, type Candidature, type QuestionEntretien, type RoleRecruteur } from "@/lib/entretien";
import { lireCandidature, marquerEtapeEntretien, cleQuestionsEntretien } from "@/lib/entretien/persistance";
import { analyserReponse, type AvisModele } from "@/lib/jury/evaluation";
import { lireCache } from "@/lib/ia-cache";
import { pousserTout } from "@/lib/sync/client";
import ExempleReponse from "@/app/components/ExempleReponse";

type Etape = "attente" | "reponse" | "evaluation";

/** Mélange déterministe-ish : spécifiques d'abord (elles font mal), puis classiques. */
function composer(candidature: Candidature | null, role: RoleRecruteur, ia: QuestionEntretien[] | null): QuestionEntretien[] {
  const classiques = questionsClassiques(role);
  if (!ia) return classiques;
  const specifiques = ia.filter((q) => q.cible === "les-deux" || q.cible === role);
  return [...specifiques, ...classiques.filter((c) => c.categorie !== "presentation" || specifiques.length === 0)].slice(0, 14);
}

/** Simulation d'entretien : le recruteur pose, tu réponds au micro, il relance. */
export default function SimulationEntretienPage() {
  const [langue, setLangue] = useState<Langue>("fr-FR");
  useEffect(() => setLangue(lireLangue(window.localStorage)), []);
  const rec = useEnregistrement(langue);
  const [candidature, setCandidature] = useState<Candidature | null | undefined>(undefined);
  const [role, setRole] = useState<RoleRecruteur>("rh");
  const [questions, setQuestions] = useState<QuestionEntretien[]>([]);
  const [index, setIndex] = useState(0);
  const [etape, setEtape] = useState<Etape>("attente");
  const [avis, setAvis] = useState<AvisModele | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState(false);
  const [reponseFinale, setReponseFinale] = useState("");
  const questionAfficheeRef = useRef(0);

  useEffect(() => {
    const c = lireCandidature(window.localStorage);
    setCandidature(c);
    if (c && c.typeEntretien !== "mixte") setRole(c.typeEntretien);
  }, []);

  useEffect(() => {
    if (candidature === undefined) return;
    const ia = candidature ? lireCache<QuestionEntretien[]>(window.localStorage, cleQuestionsEntretien(candidature)) : null;
    setQuestions(composer(candidature, role, ia));
    setIndex(0);
    setEtape("attente");
    setAvis(null);
  }, [candidature, role]);

  const question = questions[index];

  async function demarrer() {
    setAvis(null);
    setErreurIA(null);
    setReponseFinale("");
    questionAfficheeRef.current = Date.now();
    const ok = await rec.start();
    if (ok) setEtape("reponse");
  }

  async function terminer() {
    rec.stop();
    const reponse = rec.transcript();
    setReponseFinale(reponse);
    setEtape("evaluation");
    if (!reponse || !question) return;
    marquerEtapeEntretien(window.localStorage, "simulation", true);
    void pousserTout();
    setEvaluation(true);
    try {
      const res = await fetch("/api/entretien/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          reponse,
          latenceMs: Date.now() - questionAfficheeRef.current,
          role,
          langue: courte(langue),
          candidature: candidature ? { poste: candidature.poste, entreprise: candidature.entreprise, offre: candidature.offre, cvTexte: candidature.cvTexte } : undefined,
        }),
      });
      const data = (await res.json()) as { avis?: AvisModele; erreur?: string };
      if (res.ok && data.avis) setAvis(data.avis);
      else setErreurIA(data.erreur ?? "L'avis n'a pas pu être obtenu.");
    } catch {
      setErreurIA("L'avis du recruteur n'est pas disponible — les mesures ci-dessous, elles, sont calculées localement.");
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

  if (candidature === undefined) return null;
  const analyse = etape === "evaluation" && reponseFinale ? analyserReponse(reponseFinale) : null;

  return (
    <>
      <div className="toolbar">
        <fieldset className="formats formats-inline" style={{ marginBottom: 0 }}>
          <legend>Qui te reçoit ?</legend>
          {(["rh", "technique"] as const).map((r) => (
            <button key={r} type="button" className={`format-btn${role === r ? " active" : ""}`} aria-pressed={role === r} onClick={() => setRole(r)} disabled={etape === "reponse"}>
              {LIBELLES_ROLE[r]}
            </button>
          ))}
        </fieldset>
        <Link href="/app/entretien" className="btn small">
          Mon profil
        </Link>
      </div>

      {!candidature && (
        <div className="card jury-intro">
          <b>Simulation générique.</b>
          <p>
            Renseigne <Link href="/app/entretien">ton poste, l&apos;offre et ton CV</Link> : le recruteur posera des questions sur <i>ton</i> parcours et jugera tes réponses par rapport à <i>cette</i> offre.
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
            Question {index + 1} sur {questions.length} · {question.source === "ia" ? "tirée de ton CV et de l'offre" : "classique"}
          </div>
          <article className="card question-posee">
            <span className="question-cat">
              {LIBELLES_CATEGORIES_ENTRETIEN[question.categorie]} · {LIBELLES_ROLE[role]}
            </span>
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
                <span className="rec-dot" aria-hidden="true" /> Le recruteur t&apos;écoute…
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
              {evaluation && <div className="card jury-loading">Le recruteur prend ses notes…</div>}
              {erreurIA && !evaluation && (
                <div className="card jury-degrade">
                  <b>Avis du recruteur indisponible</b>
                  <p>{erreurIA}</p>
                </div>
              )}
              {avis && (
                <div className="avis">
                  <h2 className="list-title">L&apos;avis du {LIBELLES_ROLE[role].toLowerCase()}</h2>
                  <article className="card avis-bloc avis-forts">
                    <b>Ce qui fonctionne</b>
                    <ul>
                      {avis.points_forts.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="card avis-bloc avis-faibles">
                    <b>Ce qu&apos;un recruteur relèverait</b>
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
              <ExempleReponse
                question={question.question}
                pourquoi={`${question.pourquoi} Une bonne réponse : ${question.attendu}`}
                contexte={candidature ? `POSTE : ${candidature.poste} — ${candidature.entreprise}\nOFFRE : ${candidature.offre.slice(0, 2500)}\nCV : ${candidature.cvTexte.slice(0, 3000)}` : undefined}
                persona={LIBELLES_ROLE[role]}
                reponseEtudiant={reponseFinale}
              />

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
