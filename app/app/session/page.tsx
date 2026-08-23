"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession, countWords } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import ScoreReportView from "@/app/components/ScoreReportView";
import { pousserTout } from "@/lib/sync/client";
import { useEnregistrement } from "../hooks/useEnregistrement";

/**
 * Formats proposés, nommés d'après les soutenances réelles des étudiants
 * (PFA ≈ 15 min de présentation, PFE ≈ 20 min, hors questions).
 * `null` = entraînement libre, sans évaluation du temps.
 */
const FORMATS: ReadonlyArray<{ label: string; hint?: string; minutes: number | null }> = [
  { label: "Libre", minutes: null },
  { label: "5 min", hint: "pitch", minutes: 5 },
  { label: "10 min", hint: "stage", minutes: 10 },
  { label: "15 min", hint: "PFA", minutes: 15 },
  { label: "20 min", hint: "PFE", minutes: 20 },
];

export default function SessionPage() {
  const router = useRouter();
  const rec = useEnregistrement();
  const [targetMinutes, setTargetMinutes] = useState<number | null>(null);

  const targetMs = targetMinutes === null ? undefined : targetMinutes * 60_000;
  const { phase, supported, finalText, interimText, elapsedMs, error } = rec;

  function save() {
    const transcript = rec.transcript();
    saveSession(window.localStorage, {
      id: crypto.randomUUID(),
      startedAt: new Date(rec.startedAt()).toISOString(),
      durationMs: elapsedMs,
      transcript,
      wordCount: countWords(transcript),
      confidence: rec.confidence(),
      targetDurationMs: targetMs,
    });
    void pousserTout();
    router.push("/app");
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
      <h1>Session d&apos;entraînement</h1>
      <p className="subtitle">Parle comme si le jury était en face. La transcription suit en direct.</p>

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
          <button className="btn danger" onClick={rec.stop}>
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
        <ScoreReportView
          report={computeReport({
            transcript: finalText.trim(),
            durationMs: elapsedMs,
            confidence: rec.confidence(),
            targetDurationMs: targetMs,
          })}
        />
      )}

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
    </div>
  );
}
