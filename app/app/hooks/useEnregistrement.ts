"use client";

import { useEffect, useRef, useState } from "react";
import { countWords } from "@/lib/storage";

export type Phase = "idle" | "recording" | "stopped";

/** Renvoie le constructeur SpeechRecognition du navigateur, s'il existe. */
export function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export interface Enregistrement {
  phase: Phase;
  supported: boolean;
  finalText: string;
  interimText: string;
  elapsedMs: number;
  error: string | null;
  start(): Promise<boolean>;
  stop(): void;
  cleanup(): void;
  /** Confiance moyenne pondérée, ou undefined si le navigateur n'en fournit pas. */
  confidence(): number | undefined;
  /** Horodatage (ms epoch) du début de l'enregistrement. */
  startedAt(): number;
  /** Transcription finalisée, nettoyée. */
  transcript(): string;
}

/**
 * Enregistrement + transcription en direct (Web Speech API, fr-FR).
 * Partagé entre la session classique et la répétition avec slides : une
 * seule implémentation des redémarrages silencieux et des erreurs bénignes.
 */
export function useEnregistrement(): Enregistrement {
  const [phase, setPhase] = useState<Phase>("idle");
  const [supported, setSupported] = useState(true);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  async function start(): Promise<boolean> {
    setError(null);
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    try {
      // Demande explicite du micro : déclenche la permission.
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accès au micro refusé. Autorise le micro pour t'enregistrer.");
      return false;
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
    return true;
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

  return {
    phase,
    supported,
    finalText,
    interimText,
    elapsedMs,
    error,
    start,
    stop,
    cleanup,
    confidence: () => (confWeightRef.current > 0 ? confSumRef.current / confWeightRef.current : undefined),
    startedAt: () => startedAtRef.current,
    transcript: () => finalRef.current.trim(),
  };
}
