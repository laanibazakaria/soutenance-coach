"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lireLangue, courte, type Langue } from "@/lib/langue";
import { useEnregistrement } from "../hooks/useEnregistrement";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache, cleCache } from "@/lib/ia-cache";
import { lireParcours } from "@/lib/parcours/persistance";
import { saveSession, countWords } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import { cumulerSegments, planPrevu, comparer, etatSlide, type Segment, type Comparaison, type SourcePrevu } from "@/lib/repetition";
import type { Deck } from "@/lib/slides/types";
import type { Pitch } from "@/lib/pitch";
import type { SlideTiming } from "@/lib/types";
import ScoreReportView from "@/app/components/ScoreReportView";
import AvisCoach from "@/app/components/AvisCoach";
import LecteurAudio from "@/app/components/LecteurAudio";
import TranscriptAnnote from "@/app/components/TranscriptAnnote";
import JaugeDebit from "@/app/components/JaugeDebit";
import { sauverAudio } from "@/lib/audio/stockage";
import { pousserTout } from "@/lib/sync/client";
import { Icone } from "@/app/components/Icone";

const DUREES: ReadonlyArray<{ minutes: number; hint?: string }> = [
  { minutes: 5, hint: "pitch" },
  { minutes: 10, hint: "stage" },
  { minutes: 15, hint: "PFA" },
  { minutes: 20, hint: "PFE" },
];

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Le document PDF.js, typé au minimum nécessaire : on ne dépend pas de ses types internes. */
interface DocumentPDF {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(o: { scale: number }): { width: number; height: number };
    render(o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): {
      promise: Promise<void>;
      cancel(): void;
    };
  }>;
}

/**
 * Répéter avec ses slides : la diapositive courante à l'écran, le temps
 * passé dessus face au temps prévu, et à la fin le bilan diapositive par
 * diapositive. Le PDF, s'il est rechargé pour l'affichage, ne quitte pas
 * le navigateur.
 */
export default function RepetitionPage() {
  const router = useRouter();
  const [langue, setLangue] = useState<Langue>("fr-FR");
  useEffect(() => setLangue(lireLangue(window.localStorage)), []);
  const rec = useEnregistrement(langue);
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [dureeMin, setDureeMin] = useState(15);
  const [index, setIndex] = useState(0);
  const [comparaison, setComparaison] = useState<Comparaison | null>(null);
  const [reel, setReel] = useState<SlideTiming[]>([]);
  const [pdfPages, setPdfPages] = useState<number | null>(null);
  const [pdfErreur, setPdfErreur] = useState<string | null>(null);
  const [transcriptOuvert, setTranscriptOuvert] = useState(false);
  // Soutenance blanche : l'exposé est la première des trois phases ; à la fin,
  // on enchaîne sur les questions du jury au lieu de sauvegarder.
  const [blanche, setBlanche] = useState(false);
  useEffect(() => {
    setBlanche(new URLSearchParams(window.location.search).get("blanche") === "1");
  }, []);

  const segmentsRef = useRef<Segment[]>([]);
  // Fixé à l'arrêt : l'avis du coach demandé avant la sauvegarde suit la session.
  const idRef = useRef("");
  const debutSegmentRef = useRef(0);
  const pdfRef = useRef<DocumentPDF | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renduRef = useRef<{ cancel(): void } | null>(null);

  useEffect(() => {
    const d = listeDeckSauvegarde(window.localStorage);
    setDeck(d);
    const p = lireParcours(window.localStorage);
    if (p) setDureeMin(DUREES.some((x) => x.minutes === p.dureeMin) ? p.dureeMin : 15);
  }, []);

  const dureeMs = dureeMin * 60_000;
  const pitch: Pitch | null =
    deck && typeof window !== "undefined"
      ? lireCache<Pitch>(window.localStorage, cleCache("pitch", deck.slides.map((s) => s.texte), String(dureeMin)))
      : null;
  const plan = deck ? planPrevu(deck, pitch, dureeMs) : null;
  const { phase, elapsedMs } = rec;
  const slide = deck?.slides[index];
  const prevuCourant = plan?.prevu[index]?.dureeMs ?? 0;
  const surSlideMs = phase === "recording" ? elapsedMs - debutSegmentRef.current : 0;

  /* ── Navigation entre diapositives, avec découpage du temps ── */

  const aller = useCallback(
    (vers: number) => {
      if (!deck || phase !== "recording") return;
      const cible = Math.max(0, Math.min(deck.slides.length - 1, vers));
      if (cible === index) return;
      const maintenant = Date.now() - rec.startedAt();
      segmentsRef.current.push({ numero: deck.slides[index].numero, debutMs: debutSegmentRef.current, finMs: maintenant });
      debutSegmentRef.current = maintenant;
      setIndex(cible);
    },
    [deck, phase, index, rec],
  );

  useEffect(() => {
    if (phase !== "recording") return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === "ArrowRight" || ev.key === " " || ev.key === "PageDown") {
        ev.preventDefault();
        aller(index + 1);
      } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
        ev.preventDefault();
        aller(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, index, aller]);

  async function demarrer() {
    segmentsRef.current = [];
    debutSegmentRef.current = 0;
    setIndex(0);
    setComparaison(null);
    await rec.start();
  }

  function terminer() {
    if (!deck || !plan) return;
    const fin = Date.now() - rec.startedAt();
    segmentsRef.current.push({ numero: deck.slides[index].numero, debutMs: debutSegmentRef.current, finMs: fin });
    idRef.current = crypto.randomUUID();
    rec.stop();
    const cumul = cumulerSegments(segmentsRef.current);
    setReel(cumul);
    setComparaison(comparer(deck, plan.prevu, cumul));
  }

  function sauvegarder(destination?: string) {
    const transcript = rec.transcript();
    const id = idRef.current || crypto.randomUUID();
    idRef.current = id;
    const blob = rec.audioBlob();
    if (blob) void sauverAudio(id, blob);
    saveSession(window.localStorage, {
      id,
      startedAt: new Date(rec.startedAt()).toISOString(),
      durationMs: elapsedMs,
      transcript,
      wordCount: countWords(transcript),
      confidence: rec.confidence(),
      targetDurationMs: dureeMs,
      slides: reel,
      ...(rec.mesuresAudio() ? { audio: rec.mesuresAudio()! } : {}),
    });
    void pousserTout();
    router.push(destination ? `${destination}?session=${id}` : "/app/soutenance");
  }

  /* ── Affichage optionnel du vrai PDF ── */

  async function chargerPDF(file: File) {
    setPdfErreur(null);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = (await pdfjs.getDocument({ data }).promise) as unknown as DocumentPDF;
      pdfRef.current = doc;
      setPdfPages(doc.numPages);
      if (deck && doc.numPages !== deck.slides.length) {
        setPdfErreur(
          `Ce PDF a ${doc.numPages} pages, ton support analysé en a ${deck.slides.length}. Les diapositives affichées peuvent décaler — recharge le même fichier que sur la page Mes slides.`,
        );
      }
    } catch {
      setPdfErreur("Ce PDF n'a pas pu être lu.");
      pdfRef.current = null;
      setPdfPages(null);
    }
  }

  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !slide) return;
    let annule = false;
    (async () => {
      const page = await doc.getPage(Math.min(doc.numPages, slide.numero));
      if (annule) return;
      const base = page.getViewport({ scale: 1 });
      const largeur = canvas.parentElement?.clientWidth ?? 800;
      const viewport = page.getViewport({ scale: largeur / base.width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renduRef.current?.cancel();
      const tache = page.render({ canvasContext: ctx, viewport });
      renduRef.current = tache;
      try {
        await tache.promise;
      } catch {
        /* rendu annulé par un changement de diapositive : normal */
      }
    })();
    return () => {
      annule = true;
    };
  }, [slide, pdfPages, phase]);

  /* ── Rendu ── */

  if (deck === undefined) return null;

  if (!deck) {
    return (
      <div className="ia-invite">
        <h2><Icone nom="slides" /> Répéter avec mes slides</h2>
        <p>Il faut d&apos;abord déposer ton support : la répétition affiche chaque diapositive et chronomètre le temps que tu passes dessus.</p>
        <Link href="/app/slides" className="btn primary">
          <Icone nom="document" /> Déposer mes slides
        </Link>
      </div>
    );
  }

  const etatGlobal = elapsedMs > dureeMs ? "depasse" : elapsedMs > dureeMs * 0.9 ? "proche" : "dans-les-temps";
  const etatCourant = etatSlide(surSlideMs, prevuCourant);

  return (
    <div className="repetition">
      {phase === "idle" && (
        <>
          {blanche && (
            <div className="blanche-bandeau">
              <span className="question-cat">Soutenance blanche · 1/3 — l&apos;exposé</span>
              <span className="session-meta">Puis le jury enchaînera ses questions, puis le débrief.</span>
            </div>
          )}
          <p className="subtitle">
            Chaque diapositive s&apos;affiche, tu avances avec <kbd>→</kbd> ou <kbd>Espace</kbd>, et le coach
            chronomètre le temps passé sur chacune.
          </p>

          <div className="deck-head">
            <div>
              <b>{deck.nomFichier}</b> · {deck.slides.length} diapositives
            </div>
            <Link href="/app/slides" className="btn small">
              Changer de support
            </Link>
          </div>

          <fieldset className="formats">
            <legend>Durée de l&apos;exposé</legend>
            {DUREES.map((f) => (
              <button
                key={f.minutes}
                type="button"
                className={`format-btn${dureeMin === f.minutes ? " active" : ""}`}
                aria-pressed={dureeMin === f.minutes}
                onClick={() => setDureeMin(f.minutes)}
              >
                {f.minutes} min{f.hint && <span className="format-hint"> · {f.hint}</span>}
              </button>
            ))}
          </fieldset>

          <SourceDuPlan source={plan?.source ?? "uniforme"} dureeMin={dureeMin} />

          <label className="pdf-option">
            <span>
              <Icone nom="image" /> <b>Afficher les vraies diapositives</b> (optionnel) — recharge le PDF ; il reste dans ton navigateur.
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) void chargerPDF(f);
              }}
            />
            {pdfPages !== null && !pdfErreur && <span className="pdf-ok">✓ {pdfPages} pages prêtes</span>}
          </label>
          {pdfErreur && (
            <div className="warn" role="alert">
              {pdfErreur}
            </div>
          )}
          {rec.error && (
            <div className="warn" role="alert">
              {rec.error}
            </div>
          )}
          {!rec.supported && (
            <div className="warn" role="alert">
              Ton navigateur ne propose pas la reconnaissance vocale. Utilise <b>Chrome</b> ou <b>Edge</b>.
            </div>
          )}

          <div className="actions">
            <button className="btn primary big" onClick={() => void demarrer()} disabled={!rec.supported}>
              ● Démarrer la répétition
            </button>
          </div>
        </>
      )}

      {phase === "recording" && slide && (
        <>
          <div className="rep-barre">
            <div className={`rep-chrono timer-${etatGlobal}`}>
              <span className="rec-dot" aria-hidden="true" />
              {mmss(elapsedMs)} <span className="timer-target">/ {dureeMin}:00</span>
            </div>
            <div className="rep-position">
              Diapositive <b>{index + 1}</b> / {deck.slides.length}
            </div>
            <div className={`rep-chrono-slide timer-${etatCourant}`} aria-live="off">
              {mmss(surSlideMs)} <span className="timer-target">/ {mmss(prevuCourant)}</span>
            </div>
          </div>

          <JaugeDebit texte={`${rec.finalText} ${rec.interimText}`} elapsedMs={elapsedMs} />

          <div className="rep-scene">
            {pdfRef.current ? (
              <canvas ref={canvasRef} className="rep-canvas" aria-label={`Diapositive ${slide.numero}`} />
            ) : (
              <div className="rep-slide-texte">
                <div className="rep-slide-num">{slide.numero}</div>
                <h2>{slide.titre}</h2>
                <p>{slide.texte}</p>
              </div>
            )}
          </div>

          <div className="rep-nav">
            <button className="btn" onClick={() => aller(index - 1)} disabled={index === 0}>
              ← Précédente
            </button>
            <button className="btn danger" onClick={terminer}>
              ■ Terminer
            </button>
            <button className="btn primary" onClick={() => aller(index + 1)} disabled={index === deck.slides.length - 1}>
              Suivante →
            </button>
          </div>

          <p className="rep-astuce">
            <kbd>→</kbd> / <kbd>Espace</kbd> diapositive suivante · <kbd>←</kbd> précédente
          </p>

          <details className="rep-transcript" open={transcriptOuvert} onToggle={(ev) => setTranscriptOuvert((ev.target as HTMLDetailsElement).open)}>
            <summary>Transcription en direct</summary>
            <div className="transcript" aria-live="polite">
              {rec.finalText}
              <span className="interim">{rec.interimText}</span>
            </div>
          </details>
        </>
      )}

      {phase === "stopped" && comparaison && (
        <>
          <h1>Bilan de la répétition</h1>
          <p className="rep-resume">{comparaison.resume}</p>

          <div className="timeline rep-bilan">
            <div className="timeline-row rep-bilan-head">
              <span className="timeline-num" aria-hidden="true">
                #
              </span>
              <span className="timeline-titre">Diapositive</span>
              <span className="rep-col">Prévu</span>
              <span className="rep-col">Réel</span>
              <span className="rep-col">Écart</span>
            </div>
            {comparaison.lignes.map((l) => (
              <div key={l.numero} className={`timeline-row rep-ligne rep-${l.niveau}`}>
                <span className="timeline-num">{l.numero}</span>
                <span className="timeline-titre">{l.titre}</span>
                <span className="rep-col">{mmss(l.prevuMs)}</span>
                <span className="rep-col">{l.niveau === "non-vue" ? "—" : mmss(l.reelMs)}</span>
                <span className={`rep-col rep-ecart rep-ecart-${l.niveau}`}>
                  {l.niveau === "non-vue" ? "non vue" : `${l.ecart > 0 ? "+" : ""}${Math.round(l.ecart * 100)} %`}
                </span>
              </div>
            ))}
            <div className="timeline-row rep-bilan-total">
              <span className="timeline-num" aria-hidden="true">
                Σ
              </span>
              <span className="timeline-titre">Total</span>
              <span className="rep-col">{mmss(comparaison.totalPrevuMs)}</span>
              <span className="rep-col">{mmss(comparaison.totalReelMs)}</span>
              <span className="rep-col" />
            </div>
          </div>
          <p className="report-note">
            Minutage prévu : {plan?.source === "pitch" ? "celui de ton pitch" : "répartition uniforme"} pour {dureeMin} min.
            Tolérance ± 20 % (vert), ± 50 % (orange).
          </p>

          {rec.finalText.trim() !== "" && (
            <>
              <ScoreReportView
                report={computeReport({
                  transcript: rec.finalText.trim(),
                  durationMs: elapsedMs,
                  confidence: rec.confidence(),
                  targetDurationMs: dureeMs,
                })}
              />
              {rec.mesuresAudio() && <LecteurAudio sessionId="" mesures={rec.mesuresAudio()!} />}
              <TranscriptAnnote transcript={rec.finalText.trim()} />
              <AvisCoach
                session={{
                  id: idRef.current,
                  startedAt: new Date(rec.startedAt()).toISOString(),
                  durationMs: elapsedMs,
                  transcript: rec.finalText.trim(),
                  wordCount: countWords(rec.finalText.trim()),
                  confidence: rec.confidence(),
                  targetDurationMs: dureeMs,
                  slides: reel,
                }}
              />
            </>
          )}

          <div className="actions">
            {blanche ? (
              <button className="btn primary big" onClick={() => sauvegarder("/app/soutenance-blanche")} disabled={rec.finalText.trim() === ""}>
                Passer aux questions du jury →
              </button>
            ) : (
              <button className="btn primary" onClick={() => sauvegarder()} disabled={rec.finalText.trim() === ""}>
                <Icone nom="sauvegarder" /> Sauvegarder la session
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                rec.cleanup();
                router.push("/app");
              }}
            >
              Abandonner
            </button>
          </div>
          {rec.finalText.trim() === "" && (
            <p className="report-note">Rien n&apos;a été transcrit : la session ne peut pas être sauvegardée.</p>
          )}
        </>
      )}
    </div>
  );
}

function SourceDuPlan({ source, dureeMin }: { source: SourcePrevu; dureeMin: number }) {
  if (source === "pitch") {
    return (
      <p className="rep-source rep-source-pitch">
        ✓ Minutage par diapositive : <b>celui de ton pitch</b> pour {dureeMin} min.
      </p>
    );
  }
  return (
    <p className="rep-source">
      Minutage par diapositive : <b>répartition uniforme</b> ({dureeMin} min divisées par le nombre de diapositives).{" "}
      <Link href="/app/slides">Génère ton pitch pour {dureeMin} min</Link> et le plan reprendra son minutage.
    </p>
  );
}
