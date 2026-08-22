"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { extraireDeckPDF, ExtractionError } from "@/lib/slides/extract";
import { analyserDeck, repartirTemps } from "@/lib/slides/analyse";
import {
  genererQuestions,
  selectionnerPourEntrainement,
  supportExploitable,
  LIBELLES_CATEGORIES,
} from "@/lib/jury";
import { sauverDeck, listeDeckSauvegarde } from "@/lib/slides/persistance";
import type { Deck, DeckFinding, JuryQuestion } from "@/lib/slides/types";

const DUREES = [
  { label: "5 min · pitch", minutes: 5 },
  { label: "10 min · stage", minutes: 10 },
  { label: "15 min · PFA", minutes: 15 },
  { label: "20 min · PFE", minutes: 20 },
];

function formatSecondes(s: number): string {
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return min > 0 ? `${min} min ${sec.toString().padStart(2, "0")}` : `${sec} s`;
}

export default function SlidesPage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [duree, setDuree] = useState(15);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [ongletJury, setOngletJury] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const memorise = listeDeckSauvegarde(window.localStorage);
    if (memorise) setDeck(memorise);
  }, []);

  async function charger(file: File) {
    setErreur(null);
    setChargement(true);
    try {
      const d = await extraireDeckPDF(file);
      if (!supportExploitable(d)) {
        setErreur(
          "Ce PDF ne contient pas de texte extractible — il est probablement fait d'images. L'analyse a besoin du texte de tes diapositives.",
        );
        setDeck(null);
      } else {
        setDeck(d);
        sauverDeck(window.localStorage, d);
      }
    } catch (e) {
      setErreur(
        e instanceof ExtractionError ? e.message : "Impossible de lire ce fichier. Réessaie avec un autre PDF.",
      );
      setDeck(null);
    } finally {
      setChargement(false);
    }
  }

  const findings: DeckFinding[] = deck ? analyserDeck(deck, duree) : [];
  const questions: JuryQuestion[] = deck ? genererQuestions(deck) : [];
  const aRetenir = deck ? selectionnerPourEntrainement(questions, 5) : [];
  const repartition = deck ? repartirTemps(deck, duree) : [];

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Ton support de présentation</h1>
          <p className="subtitle">
            Dépose tes slides : l&apos;application les analyse et prépare les questions que le jury
            risque de poser.
          </p>
        </div>
        <Link href="/app" className="btn small">
          ← Mes sessions
        </Link>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void charger(f);
          e.target.value = "";
        }}
      />

      {!deck && (
        <div className="dropzone">
          <span className="dropzone-icon" aria-hidden="true">
            📄
          </span>
          <h2>Dépose ton PDF</h2>
          <p>
            Exporte tes slides en PDF (PowerPoint : Fichier → Exporter → PDF), puis charge-les ici.
          </p>
          <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={chargement}>
            {chargement ? "Lecture en cours…" : "Choisir un fichier PDF"}
          </button>
          <p className="dropzone-note">
            🔒 Ton fichier est lu dans ton navigateur et n&apos;est envoyé nulle part.
          </p>
        </div>
      )}

      {erreur && (
        <div className="warn" role="alert">
          {erreur}
        </div>
      )}

      {deck && (
        <>
          <div className="deck-head">
            <div>
              <b>{deck.nomFichier}</b>
              <span className="session-meta"> · {deck.slides.length} diapositives</span>
            </div>
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              Changer de fichier
            </button>
          </div>

          <fieldset className="formats">
            <legend>Durée de ta soutenance</legend>
            {DUREES.map((d) => (
              <button
                key={d.minutes}
                type="button"
                className={`format-btn${duree === d.minutes ? " active" : ""}`}
                aria-pressed={duree === d.minutes}
                onClick={() => setDuree(d.minutes)}
              >
                {d.label}
              </button>
            ))}
          </fieldset>

          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={!ongletJury}
              className={`tab${!ongletJury ? " active" : ""}`}
              onClick={() => setOngletJury(false)}
            >
              Analyse du support
            </button>
            <button
              role="tab"
              aria-selected={ongletJury}
              className={`tab${ongletJury ? " active" : ""}`}
              onClick={() => setOngletJury(true)}
            >
              🎓 Jury virtuel ({questions.length})
            </button>
          </div>

          {!ongletJury ? (
            <>
              <div className="report-grid">
                {findings.map((f) => (
                  <article key={f.id} className={`metric metric-${f.niveau}`}>
                    <header className="metric-head">
                      <span className="metric-label">{f.titre}</span>
                      <span className={`badge badge-${f.niveau}`}>
                        {f.niveau === "bon" ? "Bon" : f.niveau === "attention" ? "À surveiller" : "À corriger"}
                      </span>
                    </header>
                    <p className="metric-summary">{f.detail}</p>
                    {f.slides && (
                      <ul className="metric-details">
                        <li>Diapositives concernées : {f.slides.join(", ")}</li>
                      </ul>
                    )}
                  </article>
                ))}
              </div>

              <h2 className="list-title">Temps conseillé par diapositive</h2>
              <p className="subtitle">
                Réparti au prorata du contenu, pour tenir tes {duree} minutes. À ajuster selon
                l&apos;importance de chaque partie.
              </p>
              <div className="timeline">
                {repartition.map(({ slide, secondes }) => (
                  <div key={slide.numero} className="timeline-row">
                    <span className="timeline-num">{slide.numero}</span>
                    <span className="timeline-titre">{slide.titre}</span>
                    <span className="timeline-temps">{formatSecondes(secondes)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="actions" style={{ marginBottom: 18 }}>
                <Link href="/app/jury" className="btn primary">
                  🎓 S&apos;entraîner à répondre à l&apos;oral
                </Link>
              </div>

              <div className="card jury-intro">
                <b>Les cinq questions à préparer en priorité</b>
                <p>
                  Choisies pour couvrir des angles différents. Chacune indique <i>pourquoi</i> un
                  jury la poserait — c&apos;est ce qui permet d&apos;y répondre juste.
                </p>
              </div>

              {aRetenir.map((q) => (
                <article key={q.id} className="card question question-priorite">
                  <span className="question-cat">{LIBELLES_CATEGORIES[q.categorie]}</span>
                  <p className="question-texte">{q.question}</p>
                  <p className="question-pourquoi">💡 {q.pourquoi}</p>
                  {q.slide && <span className="question-slide">Diapositive {q.slide}</span>}
                </article>
              ))}

              <h2 className="list-title">Toutes les questions probables ({questions.length})</h2>
              {questions
                .filter((q) => !aRetenir.some((r) => r.id === q.id))
                .map((q) => (
                  <article key={q.id} className="card question">
                    <span className="question-cat">{LIBELLES_CATEGORIES[q.categorie]}</span>
                    <p className="question-texte">{q.question}</p>
                    <p className="question-pourquoi">💡 {q.pourquoi}</p>
                  </article>
                ))}

              <p className="report-note">
                Questions déduites du contenu de tes diapositives et des attendus classiques d&apos;une
                soutenance — par du code, sans modèle de langage.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
