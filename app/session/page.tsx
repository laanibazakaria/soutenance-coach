"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession, countWords } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import ScoreReportView from "@/app/components/ScoreReportView";

type Phase = "idle" | "recording" | "stopped";

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

/** Renvoie le constructeur SpeechRecognition du navigateur, s'il existe. */
function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export default function SessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [supported, setSupported] = useState(true);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [targetMinutes, setTargetMinutes] = useState<number | null>(null);

  const targetMs = targetMinutes === null ? undefined : targetMinutes * 60_000;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Le flux "final" arrive par segments : on l'accumule dans une ref pour éviter
  // les pertes quand la reconnaissance redémarre (Chrome coupe après un silence).
  const finalRef = useRef("");
  const stoppingRef = useRef(false);
  // Confiance pondérée par le nombre de mots de chaque segment finalisé :
  // un long segment sûr pèse plus qu'un mot isolé mal entendu.
  const confSumRef = useRef(0);
  const confWeightRef = useRef(0);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    stoppingRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    setError(null);
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    try {
      // Demande explicite du micro : déclenche la permission et servira à la
      // capture audio complète (étapes suivantes).
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accès au micro refusé. Autorise le micro pour t'enregistrer.");
      return;
    }

    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          const segment = res[0].transcript;
          finalRef.current += segment + " ";
          // Certains navigateurs renvoient une confiance à 0 sur les segments
          // finaux : on ne la compte que si elle est renseignée.
          const conf = res[0].confidence;
          if (typeof conf === "number" && conf > 0) {
            const poids = countWords(segment);
            confSumRef.current += conf * poids;
            confWeightRef.current += poids;
          }
        } else {
          interim += res[0].transcript;
        }
      }
      setFinalText(finalRef.current);
      setInterimText(interim);
    };

    rec.onerror = (ev) => {
      // Événements normaux du cycle de vie, pas des erreurs à montrer :
      // - "no-speech" / "aborted" : silences et arrêts volontaires ;
      // - "network" : micro-coupure du service de reconnaissance de Chrome,
      //   observée en conditions réelles — onend suit et on redémarre seul,
      //   sans perte du texte déjà finalisé.
      if (ev.error !== "no-speech" && ev.error !== "aborted" && ev.error !== "network") {
        setError(`Reconnaissance vocale : ${ev.error}`);
      }
    };

    // Chrome arrête la reconnaissance après un silence : on la relance tant
    // que l'utilisateur n'a pas explicitement arrêté la session.
    rec.onend = () => {
      if (!stoppingRef.current && recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* déjà relancée */
        }
      }
    };

    stoppingRef.current = false;
    finalRef.current = "";
    confSumRef.current = 0;
    confWeightRef.current = 0;
    setFinalText("");
    setInterimText("");
    recognitionRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);

    rec.start();
    setPhase("recording");
  }

  function stop() {
    stoppingRef.current = true;
    recognitionRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedMs(Date.now() - startedAtRef.current);
    setInterimText("");
    setPhase("stopped");
  }

  /** Confiance moyenne pondérée, ou undefined si le navigateur n'en fournit pas. */
  function currentConfidence(): number | undefined {
    return confWeightRef.current > 0 ? confSumRef.current / confWeightRef.current : undefined;
  }

  function save() {
    const transcript = finalRef.current.trim();
    saveSession(window.localStorage, {
      id: crypto.randomUUID(),
      startedAt: new Date(startedAtRef.current).toISOString(),
      durationMs: elapsedMs,
      transcript,
      wordCount: countWords(transcript),
      confidence: currentConfidence(),
      targetDurationMs: targetMs,
    });
    router.push("/");
  }

  function discard() {
    cleanup();
    router.push("/");
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
        {targetMs !== undefined && (
          <span className="timer-target"> / {targetMinutes}:00</span>
        )}
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
          <button className="btn primary" onClick={start} disabled={!supported}>
            ● Démarrer l&apos;enregistrement
          </button>
        )}
        {phase === "recording" && (
          <button className="btn danger" onClick={stop}>
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
            confidence: currentConfidence(),
            targetDurationMs: targetMs,
          })}
        />
      )}

      <div className="transcript" aria-live="polite">
        {finalText === "" && interimText === "" ? (
          <span className="transcript-placeholder">
            Ta transcription apparaîtra ici pendant que tu parles…
          </span>
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
