"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { lireLangue, courte, type Langue } from "@/lib/langue";
import { useEnregistrement } from "../hooks/useEnregistrement";
import { listSessions } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";
import type { JuryQuestion } from "@/lib/slides/types";
import { genererQuestions, selectionnerPourEntrainement, LIBELLES_CATEGORIES } from "@/lib/jury";
import { analyserReponse, type AvisModele, type AnalyseReponse } from "@/lib/jury/evaluation";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache, ecrireCache, cleCache } from "@/lib/ia-cache";
import { comparer, planPrevu } from "@/lib/repetition";
import { computeReport } from "@/lib/scoring";
import type { Pitch } from "@/lib/pitch";
import ScoreReportView from "@/app/components/ScoreReportView";
import AvisCoach from "@/app/components/AvisCoach";
import ExempleReponse from "@/app/components/ExempleReponse";
import { pousserTout } from "@/lib/sync/client";
import { signalerAppelIa } from "@/lib/usage-client";
import GrilleVue from "@/app/components/GrilleVue";
import { mesuresPourGrille } from "@/lib/grille/mesures";
import type { Evaluation } from "@/lib/grille";
import { useToast } from "@/app/components/Toast";
import { Icone } from "@/app/components/Icone";

const NB_QUESTIONS = 4;

interface Reponse {
  question: JuryQuestion;
  transcript: string;
  analyse: AnalyseReponse;
  avis: AvisModele | null;
  latenceMs: number;
}

interface Blanche {
  sessionId: string;
  faitLe: string;
  reponses: Reponse[];
  /** La grille sur l'oral ENTIER — exposé compris. C'est le seul chemin qui la produit. */
  grille?: Evaluation | null;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * La soutenance blanche : l'exposé avec les slides (page Répéter en mode
 * blanche), puis le jury qui enchaîne quatre questions et relance, puis un
 * débrief complet — temps par diapositive, mesures, avis du coach, chaque
 * réponse avec l'avis du jury.
 */
export default function SoutenanceBlanchePage() {
  const [langue, setLangue] = useState<Langue>("fr-FR");
  useEffect(() => setLangue(lireLangue(window.localStorage)), []);
  const rec = useEnregistrement(langue);
  const toast = useToast();
  const [session, setSession] = useState<SessionRecord | null | undefined>(undefined);
  const [questions, setQuestions] = useState<JuryQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"questions" | "reponse" | "evaluation" | "debrief">("questions");
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [grille, setGrille] = useState<Evaluation | null>(null);
  const [evaluation, setEvaluation] = useState(false);
  const [contexte, setContexte] = useState<string | undefined>();
  const affichageRef = useRef(0);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("session");
    const s = id ? listSessions(window.localStorage).find((x) => x.id === id) ?? null : null;
    setSession(s);
    if (!s) return;
    const deck = listeDeckSauvegarde(window.localStorage);
    const existante = lireCache<Blanche>(window.localStorage, `blanche:${s.id}`);
    if (existante) {
      setReponses(existante.reponses);
      setGrille(existante.grille ?? null);
      setPhase("debrief");
      return;
    }
    if (deck) {
      setContexte(deck.slides.map((x) => x.texte).join(" "));
      const specifiques = lireCache<JuryQuestion[]>(window.localStorage, "questions-courantes") ?? [];
      const classiques = selectionnerPourEntrainement(genererQuestions(deck), NB_QUESTIONS);
      setQuestions([...specifiques.slice(0, NB_QUESTIONS - 1), ...classiques].slice(0, NB_QUESTIONS));
    } else {
      setQuestions(selectionnerPourEntrainement(genererQuestions({ nomFichier: "", slides: [] }), NB_QUESTIONS));
    }
  }, []);

  const question = questions[index];

  async function repondre() {
    affichageRef.current = Date.now();
    if (await rec.start()) setPhase("reponse");
  }

  async function terminer() {
    rec.stop();
    const transcript = await rec.attendreTranscription();
    if (!question) return;
    const analyse = analyserReponse(transcript, Date.now() - affichageRef.current);
    setPhase("evaluation");
    setEvaluation(true);
    let avis: AvisModele | null = null;
    if (transcript) {
      try {
        const res = await fetch("/api/jury/evaluate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, reponse: transcript, latenceMs: Date.now() - affichageRef.current, contexteSlides: contexte, langue: courte(langue) }),
        });
        const data = (await res.json()) as { avis?: AvisModele; erreur?: string };
        if (res.ok && data.avis) avis = data.avis;
        else toast.info(data.erreur ?? "Avis du jury indisponible pour cette réponse — les mesures restent.");
      } catch {
        toast.info("Avis du jury indisponible — les mesures restent.");
      }
    }
    setEvaluation(false);
    const suivantes = [...reponses, { question, transcript, analyse, avis, latenceMs: Date.now() - affichageRef.current }];
    setReponses(suivantes);
    if (index + 1 >= questions.length) {
      if (session) {
        ecrireCache(window.localStorage, `blanche:${session.id}`, { sessionId: session.id, faitLe: new Date().toISOString(), reponses: suivantes } satisfies Blanche);
        void pousserTout();
        void noterOralEntier(session, suivantes);
      }
      setPhase("debrief");
    }
  }

  /**
   * La grille sur l'oral ENTIER — exposé et questions. C'est le seul exercice
   * où l'exposé a réellement eu lieu : le seul chemin vers « Prêt ». Une unité
   * de quota ; si elle échoue, le débrief reste complet sans elle.
   */
  async function noterOralEntier(seance: SessionRecord, faites: Reponse[]) {
    const morceaux = [
      "EXPOSÉ DU CANDIDAT (avec ses diapositives, " + mmss(seance.durationMs) + (seance.targetDurationMs ? " pour " + mmss(seance.targetDurationMs) + " prévues" : "") + ") :",
      seance.transcript || "(transcription vide)",
      ...faites.flatMap((f) => ["JURY : " + f.question.question, "CANDIDAT : " + (f.transcript || "(silence)")]),
    ];
    try {
      const r = await fetch("/api/grille", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          oral: "soutenance",
          echange: morceaux.join("\n\n").slice(0, 14_000),
          contexte,
          mesures: mesuresPourGrille(seance.transcript ?? "", seance.durationMs),
          dureeMin: seance.targetDurationMs ? Math.round(seance.targetDurationMs / 60_000) : undefined,
          volets: ["expose", "questions"],
          langue: courte(langue),
        }),
      });
      const j = (await r.json()) as { evaluation?: Evaluation; erreur?: string };
      if (!r.ok || !j.evaluation) throw new Error(j.erreur ?? "Grille indisponible.");
      signalerAppelIa();
      setGrille(j.evaluation);
      const existante = lireCache<Blanche>(window.localStorage, "blanche:" + seance.id);
      if (existante) ecrireCache(window.localStorage, "blanche:" + seance.id, { ...existante, grille: j.evaluation });
      void pousserTout();
    } catch {
      toast.info("La grille n'a pas pu être remplie — le débrief reste complet sans elle.");
    }
  }

  function suivante() {
    setIndex((i) => i + 1);
    setPhase("questions");
  }

  if (session === undefined) return null;

  if (!session) {
    return (
      <div className="blanche-intro">
        <div className="card">
          <h2>Une vraie répétition générale, en trois temps</h2>
          <ol className="steps" style={{ marginTop: 18 }}>
            <li>
              <span className="step-num">1</span>
              <div>
                <b>L&apos;exposé</b>
                <p>Tes slides à l&apos;écran, chronométrées diapositive par diapositive.</p>
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <b>Les questions</b>
                <p>Le jury enchaîne {NB_QUESTIONS} questions — d&apos;abord celles tirées de ton support — et relance.</p>
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <b>Le débrief</b>
                <p>Temps par diapositive, mesures, avis du coach sur l&apos;exposé, avis du jury sur chaque réponse.</p>
              </div>
            </li>
          </ol>
          <div className="actions">
            <Link href="/app/repetition?blanche=1" className="btn primary big">
              <Icone nom="soutenance" /> Commencer la soutenance blanche
            </Link>
          </div>
          <p className="report-note">Compte 25 à 35 minutes. Prévois le micro, un verre d&apos;eau, et personne dans la pièce — comme le jour J.</p>
          <p className="report-note">
            Elle rejoue l&apos;oral entier, ton exposé compris. Si tu veux seulement travailler les
            questions, en un quart d&apos;heure, prends{" "}
            <Link href="/app/appel?mode=soutenance">l&apos;appel avec le jury</Link>.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "debrief") return <Debrief session={session} reponses={reponses} grille={grille} />;

  if (!question) return <div className="card teaser">Chargement des questions…</div>;
  const derniere = reponses[reponses.length - 1];

  return (
    <>
      <div className="blanche-bandeau">
        <span className="question-cat">Soutenance blanche · 2/3 — les questions</span>
        <span className="jury-progress" style={{ margin: 0 }}>
          Question {index + 1} sur {questions.length}
        </span>
      </div>
      <article className="card question-posee">
        <span className="question-cat">{LIBELLES_CATEGORIES[question.categorie]}</span>
        <p className="question-grande">{question.question}</p>
      </article>

      {phase === "questions" && (
        <div className="actions">
          <button className="btn primary big" onClick={() => void repondre()} disabled={!rec.supported}>
            <Icone nom="micro" /> Répondre
          </button>
        </div>
      )}
      {phase === "reponse" && (
        <>
          <div className="rec-banner">
            <span className="rec-dot" aria-hidden="true" /> Le jury t&apos;écoute…
          </div>
          <div className="transcript" aria-live="polite">
            {rec.finalText === "" && rec.interimText === "" ? <span className="transcript-placeholder">Ta réponse s&apos;affichera ici…</span> : <>{rec.finalText}<span className="interim">{rec.interimText}</span></>}
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => void terminer()}>
              ■ J&apos;ai terminé ma réponse
            </button>
          </div>
        </>
      )}
      {phase === "evaluation" && (
        <>
          {evaluation ? (
            <div className="card jury-loading">Le jury prend ses notes…</div>
          ) : (
            derniere && (
              <div className="card avis-bloc avis-relance">
                <b>Le jury relance</b>
                <p>« {derniere.avis?.relance ?? "Pouvez-vous préciser ?"} »</p>
                <p className="session-meta">Pas de réponse à la relance dans la blanche : note-la, elle tombera le jour J. Le détail de chaque réponse est dans le débrief.</p>
              </div>
            )
          )}
          {!evaluation && (
            <div className="actions">
              <button className="btn primary" onClick={suivante}>
                {index + 1 >= questions.length ? "Voir le débrief →" : "Question suivante →"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Debrief({ session, reponses, grille }: { session: SessionRecord; reponses: Reponse[]; grille: Evaluation | null }) {
  const deck = listeDeckSauvegarde(window.localStorage);
  const comparaison =
    deck && session.slides && session.targetDurationMs
      ? comparer(deck, planPrevu(deck, lireCache<Pitch>(window.localStorage, cleCache("pitch", deck.slides.map((s) => s.texte), String(Math.round(session.targetDurationMs / 60000)))), session.targetDurationMs).prevu, session.slides)
      : null;
  const bonnes = reponses.filter((r) => r.analyse.constats.filter((c) => c.niveau === "bon").length >= 2).length;

  return (
    <div className="blanche-debrief">
      <div className="blanche-bandeau">
        <span className="question-cat">Soutenance blanche · 3/3 — le débrief</span>
        <span className="session-meta">{new Date(session.startedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <section className="card">
        <h2 className="list-title" style={{ marginTop: 0 }}>
          En un coup d&apos;œil
        </h2>
        <div className="chips">
          <span className="chip chip-info">⏱️ Exposé : {mmss(session.durationMs)}{session.targetDurationMs ? ` / ${mmss(session.targetDurationMs)}` : ""}</span>
          {comparaison && <span className={`chip ${comparaison.nonVues.length === 0 ? "chip-bon" : "chip-attention"}`}><Icone nom="slides" /> {comparaison.lignes.length - comparaison.nonVues.length}/{comparaison.lignes.length} diapositives montrées</span>}
          <span className="chip chip-info"><Icone nom="soutenance" /> {reponses.length} questions · {bonnes} réponses solides sur les mesures</span>
        </div>
        {comparaison && <p className="rep-resume" style={{ marginTop: 12, textAlign: "left" }}>{comparaison.resume}</p>}
      </section>

      {grille && <GrilleVue evaluation={grille} titre="Ta grille — sur l'oral entier, exposé compris" />}

      {comparaison && (
        <section>
          <h2 className="list-title">1. L&apos;exposé — temps par diapositive</h2>
          <div className="timeline rep-bilan">
            {comparaison.lignes.map((l) => (
              <div key={l.numero} className={`timeline-row rep-ligne rep-${l.niveau}`}>
                <span className="timeline-num">{l.numero}</span>
                <span className="timeline-titre">{l.titre}</span>
                <span className="rep-col">{mmss(l.prevuMs)}</span>
                <span className="rep-col">{l.niveau === "non-vue" ? "—" : mmss(l.reelMs)}</span>
                <span className={`rep-col rep-ecart rep-ecart-${l.niveau}`}>{l.niveau === "non-vue" ? "non vue" : `${l.ecart > 0 ? "+" : ""}${Math.round(l.ecart * 100)} %`}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="list-title">2. L&apos;élocution</h2>
        <ScoreReportView report={computeReport({ transcript: session.transcript, durationMs: session.durationMs, confidence: session.confidence, targetDurationMs: session.targetDurationMs })} />
        <AvisCoach auto session={session} />
      </section>

      <section>
        <h2 className="list-title">3. Les questions du jury</h2>
        {reponses.map((r, i) => (
          <article key={i} className="card blanche-reponse">
            <span className="question-cat">Question {i + 1} · {LIBELLES_CATEGORIES[r.question.categorie]}</span>
            <p className="question-texte">{r.question.question}</p>
            <div className="transcript" style={{ minHeight: 0, margin: "10px 0" }}>{r.transcript || "(aucune réponse captée)"}</div>
            <div className="chips">
              {r.analyse.constats.filter((c) => c.niveau !== "absent").map((c) => (
                <span key={c.id} className={`chip chip-${c.niveau}`}>{c.message.split(":")[0].split(".")[0]}</span>
              ))}
            </div>
            {r.avis ? (
              <div className="avis" style={{ marginTop: 12 }}>
                <div className="card avis-bloc avis-faibles"><b>Ce qu&apos;un jury relèverait</b><ul>{r.avis.points_faibles.map((p) => <li key={p}>{p}</li>)}</ul></div>
                <div className="card avis-bloc"><b>Ce que le jury attendait</b><p>{r.avis.attendu}</p></div>
                <div className="card avis-bloc avis-relance"><b>Sa relance</b><p>« {r.avis.relance} »</p></div>
              </div>
            ) : (
              <p className="report-note">Avis du jury indisponible pour cette réponse.</p>
            )}
            <ExempleReponse question={r.question.question} pourquoi={r.question.pourquoi} contexte={deck?.slides.map((x) => x.texte).join(" ")} persona="Jury de soutenance" reponseEtudiant={r.transcript} />
          </article>
        ))}
      </section>

      <div className="actions">
        <Link href="/app/repetition?blanche=1" className="btn primary">
          Refaire une soutenance blanche
        </Link>
        <Link href="/app/soutenance" className="btn">
          Retour au parcours
        </Link>
      </div>
    </div>
  );
}
