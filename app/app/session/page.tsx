"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession, countWords } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import ScoreReportView from "@/app/components/ScoreReportView";
import AvisCoach from "@/app/components/AvisCoach";
import LecteurAudio from "@/app/components/LecteurAudio";
import TranscriptAnnote from "@/app/components/TranscriptAnnote";
import JaugeDebit from "@/app/components/JaugeDebit";
import { sauverAudio } from "@/lib/audio/stockage";
import { pousserTout } from "@/lib/sync/client";
import { useEnregistrement } from "../hooks/useEnregistrement";
import { lireLangue, sauverLangue, LANGUES, type Langue } from "@/lib/langue";
import { MODULES, estModuleId } from "@/lib/modules";

/**
 * Formats proposés, nommés d'après les soutenances réelles des étudiants
 * (PFA ≈ 15 min de présentation, PFE ≈ 20 min, hors questions).
 * `null` = entraînement libre, sans évaluation du temps.
 */
const FORMATS: ReadonlyArray<{ label: string; hint?: string; minutes: number | null }> = [
  { label: "Libre", minutes: null },
  { label: "2 min", hint: "présentez-vous", minutes: 2 },
  { label: "3 min", hint: "pitch", minutes: 3 },
  { label: "5 min", hint: "pitch", minutes: 5 },
  { label: "10 min", hint: "stage", minutes: 10 },
  { label: "15 min", hint: "PFA", minutes: 15 },
  { label: "20 min", hint: "PFE", minutes: 20 },
];

export default function SessionPage() {
  const router = useRouter();
  const [langue, setLangue] = useState<Langue>("fr-FR");
  useEffect(() => setLangue(lireLangue(window.localStorage)), []);
  const rec = useEnregistrement(langue);
  const [targetMinutes, setTargetMinutes] = useState<number | null>(null);
  const [mode, setMode] = useState<"soutenance" | "entretien" | "pitch" | "concours">("soutenance");

  // Préréglage par l'URL (module Entretien : « présentez-vous » en 2 minutes).
  // Lu dans un effet plutôt qu'avec useSearchParams, qui imposerait une
  // frontière Suspense à toute la page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mode");
    if (m === "entretien" || estModuleId(m)) setMode(m);
    const format = Number(params.get("format"));
    if (FORMATS.some((f) => f.minutes === format)) setTargetMinutes(format);
  }, []);
  // L'identifiant est fixé à l'arrêt : l'avis du coach demandé avant la
  // sauvegarde reste attaché à la session une fois sauvegardée.
  const idRef = useRef("");

  const targetMs = targetMinutes === null ? undefined : targetMinutes * 60_000;
  const { phase, supported, finalText, interimText, elapsedMs, error } = rec;

  function save() {
    const transcript = rec.transcript();
    const id = idRef.current || crypto.randomUUID();
    const blob = rec.audioBlob();
    if (blob) void sauverAudio(id, blob);
    saveSession(window.localStorage, {
      id,
      startedAt: new Date(rec.startedAt()).toISOString(),
      durationMs: elapsedMs,
      transcript,
      wordCount: countWords(transcript),
      confidence: rec.confidence(),
      targetDurationMs: targetMs,
      ...(mode !== "soutenance" ? { mode } : {}),
      ...(rec.mesuresAudio() ? { audio: rec.mesuresAudio()! } : {}),
    });
    void pousserTout();
    router.push(mode === "entretien" ? "/app/entretien" : estModuleId(mode) ? `/app/m/${mode}` : "/app");
  }

  function discard() {
    rec.cleanup();
    router.push("/app");
  }

  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);

  // Couleur du minuteur en mode soutenance : vert tant qu'on est loin de la
  // cible, or dans les 10 % finaux, rouge au-delà. Aucun son, aucune coupure —
  // c'est un repère visuel, pas une contrainte.
  const ratio = targetMs ? elapsedMs / targetMs : 0;
  const timerState = !targetMs ? "libre" : ratio > 1 ? "depasse" : ratio > 0.9 ? "proche" : "dans-les-temps";

  return (
    <div className="rec-panel">

      {!supported && (
        <div className="warn" role="alert">
          Ton navigateur ne propose pas la reconnaissance vocale. Utilise <b>Chrome</b> ou{" "}
          <b>Edge</b> pour cette version — le support d&apos;autres navigateurs est prévu plus tard.
        </div>
      )}
      {error && (
        <div className="warn" role="alert">
          {error}
        </div>
      )}

      {mode === "entretien" && phase === "idle" && (
        <div className="card jury-intro" style={{ textAlign: "left" }}>
          <b>💼 « Présentez-vous. »</b>
          <p>
            Présent (qui tu es) → passé (deux expériences qui le prouvent) → futur (pourquoi ce poste). Deux minutes. Le coach
            comparera ensuite ton pitch à ton CV et à l&apos;offre.
          </p>
        </div>
      )}

      {estModuleId(mode) && phase === "idle" && (
        <div className="card jury-intro" style={{ textAlign: "left" }}>
          <b>
            {MODULES[mode].emoji} {MODULES[mode].formatTitre} — {MODULES[mode].formatMinutes} minutes
          </b>
          <p>{MODULES[mode].formatConsigne} Le coach comparera ensuite ta présentation à ton dossier.</p>
        </div>
      )}

      {phase === "idle" && (
        <fieldset className="formats formats-langue">
          <legend>Langue de l&apos;oral</legend>
          {LANGUES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`format-btn${langue === l.id ? " active" : ""}`}
              aria-pressed={langue === l.id}
              onClick={() => {
                setLangue(l.id);
                sauverLangue(window.localStorage, l.id);
              }}
            >
              {l.label}
            </button>
          ))}
        </fieldset>
      )}

      {phase === "idle" && (
        <fieldset className="formats">
          <legend>Format de l&apos;exercice</legend>
          {FORMATS.map((f) => (
            <button
              key={f.label}
              type="button"
              className={`format-btn${targetMinutes === f.minutes ? " active" : ""}`}
              aria-pressed={targetMinutes === f.minutes}
              onClick={() => setTargetMinutes(f.minutes)}
            >
              {f.label}
              {f.hint && <span className="format-hint"> · {f.hint}</span>}
            </button>
          ))}
        </fieldset>
      )}

      <div className={`timer timer-${timerState}`} aria-live="off">
        {phase === "recording" && <span className="rec-dot" aria-hidden="true" />}
        {minutes}:{seconds.toString().padStart(2, "0")}
        {targetMs !== undefined && <span className="timer-target"> / {targetMinutes}:00</span>}
      </div>

      {phase === "recording" && <JaugeDebit texte={`${finalText} ${interimText}`} elapsedMs={elapsedMs} />}

      {phase === "recording" && targetMs !== undefined && (
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(ratio * 100))}
          aria-label="Progression vers la durée visée"
        >
          <div className={`progress-bar progress-${timerState}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      )}

      <div className="actions">
        {phase === "idle" && (
          <button className="btn primary" onClick={() => void rec.start()} disabled={!supported}>
            ● Démarrer l&apos;enregistrement
          </button>
        )}
        {phase === "recording" && (
          <button
            className="btn danger"
            onClick={() => {
              idRef.current = crypto.randomUUID();
              rec.stop();
            }}
          >
            ■ Arrêter
          </button>
        )}
        {phase === "stopped" && (
          <>
            <button className="btn primary" onClick={save} disabled={finalText.trim() === ""}>
              💾 Sauvegarder la session
            </button>
            <button className="btn" onClick={discard}>
              Abandonner
            </button>
          </>
        )}
      </div>

      {phase === "stopped" && finalText.trim() !== "" && (
        <>
          <ScoreReportView
            report={computeReport({
              transcript: finalText.trim(),
              durationMs: elapsedMs,
              confidence: rec.confidence(),
              targetDurationMs: targetMs,
            })}
          />
          {rec.mesuresAudio() && <LecteurAudio sessionId="" mesures={rec.mesuresAudio()!} />}
          <TranscriptAnnote transcript={finalText.trim()} />
          <AvisCoach
            session={{
              id: idRef.current,
              startedAt: new Date(rec.startedAt()).toISOString(),
              durationMs: elapsedMs,
              transcript: finalText.trim(),
              wordCount: countWords(finalText.trim()),
              confidence: rec.confidence(),
              targetDurationMs: targetMs,
              ...(mode !== "soutenance" ? { mode } : {}),
            }}
          />
        </>
      )}

      {phase !== "stopped" && (
        <div className="transcript" aria-live="polite">
          {finalText === "" && interimText === "" ? (
            <span className="transcript-placeholder">Ta transcription apparaîtra ici pendant que tu parles…</span>
          ) : (
            <>
              {finalText}
              <span className="interim">{interimText}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
