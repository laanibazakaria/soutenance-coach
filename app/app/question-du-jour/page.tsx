"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { lireLangue, courte, type Langue } from "@/lib/langue";
import { useEnregistrement } from "../hooks/useEnregistrement";
import { questionDuJour, marquerJour, calculerSerie, phraseSerie, type CandidateQuestion, type Serie } from "@/lib/quotidien";
import { dateDuJour } from "@/lib/parcours";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { genererQuestions, selectionnerPourEntrainement } from "@/lib/jury";
import { analyserReponse, type AvisModele, type AnalyseReponse } from "@/lib/jury/evaluation";
import type { JuryQuestion } from "@/lib/slides/types";
import { lireCandidature, cleQuestionsEntretien } from "@/lib/entretien/persistance";
import { questionsClassiques, type QuestionEntretien } from "@/lib/entretien";
import { MODULES, IDS_MODULES, questionsClassiquesModule, contexteProfil } from "@/lib/modules";
import { lireProfil, cleQuestionsModule } from "@/lib/modules/persistance";
import { lireModulesActifs } from "@/lib/preferences";
import { pousserTout, signalerSynchronisation } from "@/lib/sync/client";
import ExempleReponse from "@/app/components/ExempleReponse";
import { useToast } from "@/app/components/Toast";

export const CLE_SERIE = "serie";
const DUREE_MAX_MS = 60_000;

interface ResultatDuJour {
  question: CandidateQuestion;
  transcript: string;
  analyse: AnalyseReponse;
  avis: AvisModele | null;
}

/** Toutes les questions disponibles selon les modules actifs — spécifiques d'abord. */
export function candidatesDuJour(storage: Storage): CandidateQuestion[] {
  const actifs = lireModulesActifs(storage) ?? ["soutenance"];
  const out: CandidateQuestion[] = [];
  if (actifs.includes("soutenance")) {
    const deck = listeDeckSauvegarde(storage);
    const specifiques = lireCache<JuryQuestion[]>(storage, "questions-courantes") ?? [];
    const base = specifiques.length >= 3 ? specifiques : selectionnerPourEntrainement(genererQuestions(deck ?? { nomFichier: "", slides: [] }), 8);
    out.push(...base.map((q) => ({ id: `s:${q.id}`, question: q.question, pourquoi: q.pourquoi, source: "soutenance" as const })));
  }
  if (actifs.includes("entretien")) {
    const c = lireCandidature(storage);
    const ia = c ? lireCache<QuestionEntretien[]>(storage, cleQuestionsEntretien(c)) : null;
    const base = ia && ia.length >= 3 ? ia : questionsClassiques(c && c.typeEntretien !== "mixte" ? c.typeEntretien : "les-deux");
    out.push(...base.map((q) => ({ id: `e:${q.id}`, question: q.question, pourquoi: `${q.pourquoi} Une bonne réponse : ${q.attendu}`, source: "entretien" as const })));
  }
  for (const id of IDS_MODULES) {
    if (!actifs.includes(id)) continue;
    const p = lireProfil(storage, id);
    const ia = p ? lireCache<QuestionEntretien[]>(storage, cleQuestionsModule(p)) : null;
    const base = ia && ia.length >= 3 ? ia : questionsClassiquesModule(MODULES[id]);
    out.push(...base.map((q) => ({ id: `${id}:${q.id}`, question: q.question, pourquoi: `${q.pourquoi} Une bonne réponse : ${q.attendu}`, source: id })));
  }
  return out;
}

/** La question du jour : une minute au micro, un retour, et la série continue. */
export default function QuestionDuJourPage() {
  const [langue, setLangue] = useState<Langue>("fr-FR");
  useEffect(() => setLangue(lireLangue(window.localStorage)), []);
  const rec = useEnregistrement(langue);
  const toast = useToast();
  const aujourdhui = dateDuJour();
  const [question, setQuestion] = useState<CandidateQuestion | null | undefined>(undefined);
  const [resultat, setResultat] = useState<ResultatDuJour | null>(null);
  const [evaluation, setEvaluation] = useState(false);
  const [serie, setSerie] = useState<Serie | null>(null);
  const [contexte, setContexte] = useState<string | undefined>();
  const affichageRef = useRef(0);
  const arretAuto = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ls = window.localStorage;
    const deja = lireCache<ResultatDuJour>(ls, `qdj:${aujourdhui}`);
    setSerie(lireCache<Serie>(ls, CLE_SERIE));
    if (deja) {
      setQuestion(deja.question);
      setResultat(deja);
      return;
    }
    const q = questionDuJour(aujourdhui, candidatesDuJour(ls));
    setQuestion(q);
    if (q?.source === "soutenance") setContexte(listeDeckSauvegarde(ls)?.slides.map((s) => s.texte).join(" "));
    if (q?.source === "entretien") {
      const c = lireCandidature(ls);
      if (c) setContexte(`POSTE : ${c.poste} — ${c.entreprise}\nOFFRE : ${c.offre.slice(0, 2500)}\nCV : ${c.cvTexte.slice(0, 3000)}`);
    }
    if (q && (q.source === "pitch" || q.source === "concours")) {
      const p = lireProfil(ls, q.source);
      if (p) setContexte(contexteProfil(MODULES[q.source], p));
    }
  }, [aujourdhui]);

  useEffect(() => {
    if (rec.phase !== "recording") return;
    arretAuto.current = setTimeout(() => void terminer(), DUREE_MAX_MS);
    return () => {
      if (arretAuto.current) clearTimeout(arretAuto.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.phase]);

  async function repondre() {
    affichageRef.current = Date.now();
    await rec.start();
  }

  async function terminer() {
    if (arretAuto.current) clearTimeout(arretAuto.current);
    rec.stop();
    const transcript = rec.transcript();
    if (!question) return;
    const latenceMs = Date.now() - affichageRef.current;
    const analyse = analyserReponse(transcript, latenceMs);
    let avis: AvisModele | null = null;
    if (transcript) {
      setEvaluation(true);
      try {
        const route = question.source === "soutenance" ? "/api/jury/evaluate" : question.source === "entretien" ? "/api/entretien/evaluate" : "/api/modules/evaluate";
        const corps: Record<string, unknown> = { reponse: transcript, latenceMs, langue: courte(langue) };
        if (question.source === "soutenance") Object.assign(corps, { question: { id: question.id, question: question.question, pourquoi: question.pourquoi, categorie: "methode" }, contexteSlides: contexte });
        else if (question.source === "entretien") {
          const c = lireCandidature(window.localStorage);
          Object.assign(corps, { question: { id: question.id, question: question.question, pourquoi: question.pourquoi, attendu: "", categorie: "experience", cible: "les-deux", source: "ia" }, role: c && c.typeEntretien === "technique" ? "technique" : "rh", candidature: c ? { poste: c.poste, entreprise: c.entreprise, offre: c.offre, cvTexte: c.cvTexte } : undefined });
        } else {
          const p = lireProfil(window.localStorage, question.source);
          Object.assign(corps, { module: question.source, question: { id: question.id, question: question.question, pourquoi: question.pourquoi, attendu: "", categorie: "experience", cible: "les-deux", source: "ia" }, profil: p ? { champs: p.champs, documentTexte: p.documentTexte } : undefined });
        }
        const res = await fetch(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
        const data = (await res.json()) as { avis?: AvisModele; erreur?: string };
        if (res.ok && data.avis) avis = data.avis;
        else toast.info(data.erreur ?? "Avis indisponible — les mesures restent.");
      } catch {
        toast.info("Avis indisponible — les mesures restent.");
      } finally {
        setEvaluation(false);
      }
    }
    const r: ResultatDuJour = { question, transcript, analyse, avis };
    ecrireCache(window.localStorage, `qdj:${aujourdhui}`, r);
    const s = marquerJour(lireCache<Serie>(window.localStorage, CLE_SERIE), aujourdhui);
    ecrireCache(window.localStorage, CLE_SERIE, s);
    setSerie(s);
    setResultat(r);
    signalerSynchronisation();
    void pousserTout();
  }

  if (question === undefined) return null;
  const etatSerie = calculerSerie(serie, aujourdhui);

  if (!question) {
    return (
      <div className="card teaser">
        Pas encore de question : <Link href="/app?choisir=1">choisis un oral</Link> et dépose ton support, ton CV ou ton dossier — la question du jour sera tirée de <i>ton</i> projet.
      </div>
    );
  }

  const restant = Math.max(0, Math.ceil((DUREE_MAX_MS - rec.elapsedMs) / 1000));

  return (
    <div className="qdj">
      <div className="card qdj-serie">
        <span className="qdj-flamme" aria-hidden="true">
          {etatSerie.courante >= 3 ? "🔥" : "📅"}
        </span>
        <div>
          <b>{etatSerie.courante > 0 ? `${etatSerie.courante} jour${etatSerie.courante > 1 ? "s" : ""} d'affilée` : "Ta série"}</b>
          <p className="session-meta">{phraseSerie(etatSerie)}{etatSerie.record >= 2 ? ` · record : ${etatSerie.record}` : ""}</p>
        </div>
      </div>

      <article className="card question-posee">
        <span className="question-cat">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · {question.source === "soutenance" ? "ton jury" : question.source === "entretien" ? "ton recruteur" : MODULES[question.source].persona}</span>
        <p className="question-grande">{question.question}</p>
        {(resultat || rec.phase !== "idle") && <p className="question-pourquoi">💡 {question.pourquoi}</p>}
      </article>

      {!resultat && rec.phase === "idle" && (
        <div className="actions">
          <button className="btn primary big" onClick={() => void repondre()} disabled={!rec.supported}>
            🎤 Répondre — 60 secondes max
          </button>
        </div>
      )}
      {!resultat && rec.phase === "recording" && (
        <>
          <div className={`timer ${restant <= 10 ? "timer-depasse" : "timer-dans-les-temps"}`}>{restant} s</div>
          <div className="transcript" aria-live="polite">
            {rec.finalText === "" && rec.interimText === "" ? <span className="transcript-placeholder">Ta réponse s&apos;affichera ici…</span> : <>{rec.finalText}<span className="interim">{rec.interimText}</span></>}
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => void terminer()}>
              ■ J&apos;ai terminé
            </button>
          </div>
        </>
      )}
      {!resultat && rec.phase === "stopped" && evaluation && <div className="card jury-loading">Le jury prend ses notes…</div>}

      {resultat && (
        <>
          <div className="card notice-lien" style={{ borderLeftColor: "var(--ok)" }}>
            ✅ Fait pour aujourd&apos;hui. {phraseSerie(calculerSerie(serie, aujourdhui))}
          </div>
          <div className="transcript">{resultat.transcript || "(aucune réponse captée)"}</div>
          <div className="report-grid" style={{ marginBottom: 14 }}>
            {resultat.analyse.constats.filter((c) => c.niveau !== "absent").map((c) => (
              <article key={c.id} className={`metric metric-${c.niveau}`}>
                <p className="metric-summary">{c.message}</p>
              </article>
            ))}
          </div>
          {resultat.avis && (
            <div className="avis">
              <article className="card avis-bloc avis-faibles"><b>Ce qu&apos;il relèverait</b><ul>{resultat.avis.points_faibles.map((p) => <li key={p}>{p}</li>)}</ul></article>
              <article className="card avis-bloc"><b>Ce qu&apos;il attendait</b><p>{resultat.avis.attendu}</p></article>
              <article className="card avis-bloc avis-relance"><b>Sa relance</b><p>« {resultat.avis.relance} »</p></article>
            </div>
          )}
          <ExempleReponse question={question.question} pourquoi={question.pourquoi} contexte={contexte} persona={question.source === "soutenance" ? "Jury de soutenance" : question.source === "entretien" ? "Recruteur" : MODULES[question.source].persona} reponseEtudiant={resultat.transcript} />
          <div className="actions">
            <Link href="/app" className="btn primary">
              Retour à l&apos;accueil
            </Link>
            <Link href={question.source === "soutenance" ? "/app/jury" : question.source === "entretien" ? "/app/entretien/simulation" : `/app/m/${question.source}/simulation`} className="btn">
              Continuer avec d&apos;autres questions →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
