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
import { cleCache, lireCache, ecrireCache } from "@/lib/ia-cache";
import { pitchEnTexte, type Pitch } from "@/lib/pitch";
import { pousserTout } from "@/lib/sync/client";
import type { Deck, DeckFinding, JuryQuestion } from "@/lib/slides/types";

const DUREES = [
  { label: "5 min · pitch", minutes: 5 },
  { label: "10 min · stage", minutes: 10 },
  { label: "15 min · PFA", minutes: 15 },
  { label: "20 min · PFE", minutes: 20 },
];

type Onglet = "analyse" | "pitch" | "jury";

function formatSecondes(s: number): string {
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return min > 0 ? `${min} min ${sec.toString().padStart(2, "0")}` : `${sec} s`;
}

/** Corps envoyé aux routes IA : le texte extrait, jamais le PDF. */
function corpsPour(deck: Deck, dureeMinutes: number) {
  return JSON.stringify({
    nomFichier: deck.nomFichier,
    dureeMinutes,
    slides: deck.slides.map((s) => ({ numero: s.numero, titre: s.titre, texte: s.texte })),
  });
}

export default function SlidesPage() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [duree, setDuree] = useState(15);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("analyse");
  const fileRef = useRef<HTMLInputElement>(null);

  // Résultats IA, par support + durée (cache local pour ne pas redemander).
  const [questionsIA, setQuestionsIA] = useState<JuryQuestion[] | null>(null);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [iaEnCours, setIaEnCours] = useState<"questions" | "pitch" | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    const memorise = listeDeckSauvegarde(window.localStorage);
    if (memorise) setDeck(memorise);
  }, []);

  // À chaque changement de support ou de durée : relire le cache.
  useEffect(() => {
    if (!deck) return;
    const textes = deck.slides.map((s) => s.texte);
    setQuestionsIA(lireCache<JuryQuestion[]>(window.localStorage, cleCache("questions", textes)));
    setPitch(lireCache<Pitch>(window.localStorage, cleCache("pitch", textes, String(duree))));
    setErreurIA(null);
  }, [deck, duree]);

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
        void pousserTout();
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

  async function genererQuestionsIA() {
    if (!deck) return;
    setIaEnCours("questions");
    setErreurIA(null);
    try {
      const res = await fetch("/api/jury/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: corpsPour(deck, duree),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.questions)) {
        const textes = deck.slides.map((s) => s.texte);
        ecrireCache(window.localStorage, cleCache("questions", textes), data.questions);
        // Pointeur « courant » pour la simulation d'entretien.
        ecrireCache(window.localStorage, "questions-courantes", data.questions);
        setQuestionsIA(data.questions as JuryQuestion[]);
        void pousserTout();
      } else {
        setErreurIA(data.erreur ?? "Génération impossible.");
      }
    } catch {
      setErreurIA("Le service IA est injoignable. Les questions classiques restent disponibles.");
    } finally {
      setIaEnCours(null);
    }
  }

  async function genererPitch() {
    if (!deck) return;
    setIaEnCours("pitch");
    setErreurIA(null);
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: corpsPour(deck, duree),
      });
      const data = await res.json();
      if (res.ok && data.pitch) {
        const textes = deck.slides.map((s) => s.texte);
        ecrireCache(window.localStorage, cleCache("pitch", textes, String(duree)), data.pitch);
        setPitch(data.pitch as Pitch);
        void pousserTout();
      } else {
        setErreurIA(data.erreur ?? "Génération impossible.");
      }
    } catch {
      setErreurIA("Le service IA est injoignable.");
    } finally {
      setIaEnCours(null);
    }
  }

  async function copierPitch() {
    if (!pitch || !deck) return;
    await navigator.clipboard.writeText(pitchEnTexte(pitch, deck));
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  const findings: DeckFinding[] = deck ? analyserDeck(deck, duree) : [];
  const questionsClassiques: JuryQuestion[] = deck ? genererQuestions(deck) : [];
  const classiquesARetenir = deck ? selectionnerPourEntrainement(questionsClassiques, 5) : [];
  const repartition = deck ? repartirTemps(deck, duree) : [];
  const totalPitch = pitch ? pitch.slides.reduce((n, s) => n + s.secondes, 0) : 0;

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Ton support de présentation</h1>
          <p className="subtitle">
            Dépose tes slides : analyse, script de présentation, et les questions que ce jury-là te
            posera.
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
            🔒 Ton fichier est lu dans ton navigateur. Seul le texte des diapositives est envoyé à
            l&apos;IA pour le pitch et les questions — jamais le PDF.
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
            {(
              [
                ["analyse", "Analyse du support"],
                ["pitch", "🎬 Mon pitch"],
                ["jury", "🎓 Jury virtuel"],
              ] as Array<[Onglet, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={onglet === id}
                className={`tab${onglet === id ? " active" : ""}`}
                onClick={() => setOnglet(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {erreurIA && (
            <div className="warn" role="alert">
              {erreurIA}
            </div>
          )}

          {/* ── ANALYSE ── */}
          {onglet === "analyse" && (
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
                Réparti au prorata du contenu, pour tenir tes {duree} minutes.
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
          )}

          {/* ── PITCH ── */}
          {onglet === "pitch" && (
            <>
              {!pitch ? (
                <div className="ia-invite">
                  <h2>Le script de ta présentation, rédigé pour tes slides</h2>
                  <p>
                    Accroche, ce que dire sur chaque diapositive, transitions, conclusion, et le
                    minutage pour tenir tes {duree} minutes. Tu l&apos;adaptes à ta voix — c&apos;est
                    un point de départ solide, pas un texte à réciter.
                  </p>
                  <button className="btn primary big" onClick={genererPitch} disabled={iaEnCours !== null}>
                    {iaEnCours === "pitch" ? "Rédaction en cours… (20 à 40 s)" : "✨ Rédiger mon pitch"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="pitch-head">
                    <span className="session-meta">
                      {pitch.slides.length} diapositives · {formatSecondes(totalPitch)} de parole
                    </span>
                    <div className="list-actions">
                      <button className="btn small" onClick={copierPitch}>
                        {copie ? "✓ Copié" : "📋 Copier le script"}
                      </button>
                      <button className="btn small" onClick={genererPitch} disabled={iaEnCours !== null}>
                        {iaEnCours === "pitch" ? "Rédaction…" : "↻ Régénérer"}
                      </button>
                    </div>
                  </div>

                  <article className="card pitch-bloc pitch-accroche">
                    <span className="question-cat">Accroche</span>
                    <p className="pitch-texte">{pitch.accroche}</p>
                  </article>

                  {pitch.slides.map((s) => {
                    const slide = deck.slides.find((d) => d.numero === s.numero);
                    return (
                      <article key={s.numero} className="card pitch-bloc">
                        <header className="pitch-slide-head">
                          <span>
                            <span className="timeline-num">{s.numero}</span>{" "}
                            <b>{slide?.titre ?? `Diapositive ${s.numero}`}</b>
                          </span>
                          <span className="timeline-temps">{formatSecondes(s.secondes)}</span>
                        </header>
                        {s.messageCle && <p className="pitch-cle">🎯 {s.messageCle}</p>}
                        <p className="pitch-texte">{s.texte}</p>
                        {s.transition && <p className="pitch-transition">→ {s.transition}</p>}
                      </article>
                    );
                  })}

                  <article className="card pitch-bloc pitch-accroche">
                    <span className="question-cat">Conclusion</span>
                    <p className="pitch-texte">{pitch.conclusion}</p>
                  </article>

                  {pitch.conseils.length > 0 && (
                    <article className="card pitch-bloc pitch-conseils">
                      <b>Conseils de livraison pour ce support</b>
                      <ul>
                        {pitch.conseils.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </article>
                  )}

                  <div className="actions">
                    <Link href="/app/session" className="btn primary">
                      🎤 Répéter ce pitch en conditions réelles
                    </Link>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── JURY ── */}
          {onglet === "jury" && (
            <>
              {!questionsIA ? (
                <div className="ia-invite">
                  <h2>Les questions que ce jury-là te posera</h2>
                  <p>
                    Pas des questions passe-partout : celles qui citent tes technologies, tes
                    chiffres, tes choix — et les faiblesses que le jury ira chercher.
                  </p>
                  <button
                    className="btn primary big"
                    onClick={genererQuestionsIA}
                    disabled={iaEnCours !== null}
                  >
                    {iaEnCours === "questions" ? "Le jury lit tes slides… (15 à 30 s)" : "✨ Générer les questions de mon projet"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="pitch-head">
                    <span className="session-meta">
                      {questionsIA.length} questions spécifiques à ton projet
                    </span>
                    <div className="list-actions">
                      <button className="btn small" onClick={genererQuestionsIA} disabled={iaEnCours !== null}>
                        {iaEnCours === "questions" ? "Génération…" : "↻ Régénérer"}
                      </button>
                      <Link href="/app/jury" className="btn primary small">
                        🎓 S&apos;entraîner à répondre
                      </Link>
                    </div>
                  </div>

                  {questionsIA.map((q) => (
                    <article key={q.id} className="card question question-priorite">
                      <span className="question-cat">{LIBELLES_CATEGORIES[q.categorie]}</span>
                      <p className="question-texte">{q.question}</p>
                      <p className="question-pourquoi">💡 {q.pourquoi}</p>
                      {q.slide && <span className="question-slide">Diapositive {q.slide}</span>}
                    </article>
                  ))}
                </>
              )}

              <details className="classiques">
                <summary>
                  Les questions classiques de toute soutenance ({classiquesARetenir.length})
                </summary>
                {classiquesARetenir.map((q) => (
                  <article key={q.id} className="card question">
                    <span className="question-cat">{LIBELLES_CATEGORIES[q.categorie]}</span>
                    <p className="question-texte">{q.question}</p>
                    <p className="question-pourquoi">💡 {q.pourquoi}</p>
                  </article>
                ))}
              </details>
            </>
          )}
        </>
      )}
    </>
  );
}
