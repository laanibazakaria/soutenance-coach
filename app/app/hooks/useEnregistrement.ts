"use client";

import { useEffect, useRef, useState } from "react";
import { countWords } from "@/lib/storage";
import { mesurerAudio, type MesuresAudio } from "@/lib/audio/mesures";

export type Phase = "idle" | "recording" | "stopped";
export type Langue = "fr-FR" | "en-US";

/** Renvoie le constructeur SpeechRecognition du navigateur, s'il existe. */
export function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const PAS_MESURE_MS = 100;

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
  /** L'audio enregistré (webm/opus), disponible après l'arrêt — reste sur l'appareil. */
  audioBlob(): Blob | null;
  /** Mesures sur le son (silences, dynamique), disponibles après l'arrêt. */
  mesuresAudio(): MesuresAudio | null;
}

/**
 * Enregistrement + transcription en direct (Web Speech API), capture audio
 * locale (MediaRecorder) et intensité échantillonnée (Web Audio) pour les
 * mesures de silence et de dynamique. Partagé entre toutes les pages qui
 * écoutent : une seule implémentation des redémarrages silencieux.
 */
export function useEnregistrement(langue: Langue = "fr-FR"): Enregistrement {
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
  const confSumRef = useRef(0);
  const confWeightRef = useRef(0);
  // Capture audio locale et mesures d'intensité.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rmsRef = useRef<number[]>([]);
  const mesureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mesuresRef = useRef<MesuresAudio | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function arreterCapture() {
    if (mesureTimerRef.current) clearInterval(mesureTimerRef.current);
    mesureTimerRef.current = null;
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {
      /* déjà arrêté */
    }
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function cleanup() {
    stoppingRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    arreterCapture();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function demarrerCapture(stream: MediaStream) {
    morceauxRef.current = [];
    blobRef.current = null;
    rmsRef.current = [];
    mesuresRef.current = null;
    // Enregistrement local — aucune exigence : si le navigateur refuse, on transcrit quand même.
    try {
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) morceauxRef.current.push(e.data);
      };
      rec.onstop = () => {
        blobRef.current = morceauxRef.current.length ? new Blob(morceauxRef.current, { type: rec.mimeType || "audio/webm" }) : null;
      };
      rec.start(1000);
      recorderRef.current = rec;
    } catch {
      recorderRef.current = null;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const tampon = new Float32Array(analyser.fftSize);
      audioCtxRef.current = ctx;
      mesureTimerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(tampon);
        let somme = 0;
        for (let i = 0; i < tampon.length; i++) somme += tampon[i] * tampon[i];
        rmsRef.current.push(Math.sqrt(somme / tampon.length));
      }, PAS_MESURE_MS);
    } catch {
      audioCtxRef.current = null;
    }
  }

  async function start(): Promise<boolean> {
    setError(null);
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accès au micro refusé. Autorise le micro pour t'enregistrer.");
      return false;
    }
    if (mediaStreamRef.current) demarrerCapture(mediaStreamRef.current);

    const rec = new Ctor();
    rec.lang = langue;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          const segment = res[0].transcript;
          finalRef.current += segment + " ";
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
      // "no-speech" / "aborted" : cycle de vie normal ; "network" : micro-coupure
      // du service de reconnaissance, onend suit et on redémarre seul.
      if (ev.error !== "no-speech" && ev.error !== "aborted" && ev.error !== "network") {
        setError(`Reconnaissance vocale : ${ev.error}`);
      }
    };

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
    mesuresRef.current = mesurerAudio(rmsRef.current, PAS_MESURE_MS);
    arreterCapture();
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
    audioBlob: () => blobRef.current,
    mesuresAudio: () => mesuresRef.current,
  };
}
