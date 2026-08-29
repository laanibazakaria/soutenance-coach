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

/**
 * Vrai dès qu'un appareil a prouvé que sa dictée native ne transcrit rien
 * (le Samsung de Zakaria : elle démarre, puis silence). On passe alors par
 * segments envoyés au serveur (/api/transcrire) — et on y reste pour toute
 * la session de navigation, pour ne pas re-perdre 12 s à chaque essai.
 */
let segmentsPrefere = false;

const SEGMENT_MS = 3_500;

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
  /**
   * Comme transcript(), mais attend d'abord que la transcription soit réglée :
   * en repli serveur, le dernier segment part À l'arrêt et revient une à
   * quatre secondes plus tard — le lire trop tôt tronquait la réponse.
   * En dictée native, résout immédiatement. Borné à 8 s.
   */
  attendreTranscription(): Promise<string>;
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
  // Le repli par segments (navigateurs sans dictée, ou dictée native muette).
  const segRecRef = useRef<MediaRecorder | null>(null);
  const segTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const basculeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultatsRecusRef = useRef(false);
  const redemarragesRef = useRef(0);
  /** Segments partis en transcription et pas encore revenus. */
  const enVolRef = useRef(0);
  /** Faux entre l'arrêt d'un enregistreur de segment et l'envoi de sa fin. */
  const flushFaitRef = useRef(true);
  const rmsRef = useRef<number[]>([]);
  const mesureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mesuresRef = useRef<MesuresAudio | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null || (typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)));
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

  function arreterSegments() {
    if (segTimerRef.current) clearTimeout(segTimerRef.current);
    segTimerRef.current = null;
    if (basculeTimerRef.current) clearTimeout(basculeTimerRef.current);
    basculeTimerRef.current = null;
    try {
      if (segRecRef.current && segRecRef.current.state !== "inactive") {
        flushFaitRef.current = false;
        segRecRef.current.stop();
      }
    } catch {
      /* déjà arrêté */
    }
    segRecRef.current = null;
  }

  /**
   * Le repli : le micro est enregistré par segments autonomes de ~3,5 s
   * (un MediaRecorder redémarré à chaque fois — un fragment de timeslice
   * n'est pas un fichier lisible), chaque segment part en transcription au
   * serveur et le texte s'accumule comme si la dictée native l'avait rendu.
   */
  function tournerSegments() {
    const flux = mediaStreamRef.current;
    if (stoppingRef.current || !flux) return;
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    let enr: MediaRecorder;
    try {
      enr = new MediaRecorder(flux, type ? { mimeType: type } : undefined);
    } catch {
      // Deux enregistreurs sur le même flux, certains navigateurs refusent :
      // on sacrifie la capture locale, la transcription passe d'abord.
      try {
        recorderRef.current?.stop();
      } catch {
        /* déjà arrêté */
      }
      recorderRef.current = null;
      try {
        enr = new MediaRecorder(flux, type ? { mimeType: type } : undefined);
      } catch {
        return;
      }
    }
    segRecRef.current = enr;
    const morceaux: Blob[] = [];
    enr.ondataavailable = (e) => {
      if (e.data.size > 0) morceaux.push(e.data);
    };
    enr.onstop = () => {
      // Le segment suivant démarre tout de suite : pas de trou d'écoute.
      if (!stoppingRef.current) tournerSegments();
      const blob = new Blob(morceaux, { type: type ?? "audio/webm" });
      if (blob.size < 200) {
        flushFaitRef.current = true;
        return;
      }
      const fd = new FormData();
      fd.append("audio", blob, "segment.webm");
      fd.append("langue", langue.startsWith("en") ? "en" : "fr");
      enVolRef.current += 1;
      flushFaitRef.current = true;
      fetch("/api/transcrire", { method: "POST", body: fd })
        .then((r) => (r.ok ? (r.json() as Promise<{ texte?: string }>) : { texte: "" }))
        .then(({ texte }) => {
          const propre = (texte ?? "").trim();
          if (!propre) return;
          finalRef.current += propre + " ";
          setFinalText(finalRef.current);
        })
        .catch(() => {
          /* segment perdu : le suivant compensera */
        })
        .finally(() => {
          enVolRef.current -= 1;
        });
    };
    enr.start();
    segTimerRef.current = setTimeout(() => {
      try {
        if (enr.state === "recording") enr.stop();
      } catch {
        /* déjà arrêté */
      }
    }, SEGMENT_MS);
  }

  /** La dictée native a prouvé qu'elle ne rend rien ici : segments serveur. */
  function basculerSurSegments() {
    if (segRecRef.current || stoppingRef.current) return;
    segmentsPrefere = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setInterimText("");
    tournerSegments();
  }

  function cleanup() {
    stoppingRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    arreterSegments();
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
    if (!Ctor && typeof MediaRecorder === "undefined") return false;

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accès au micro refusé. Autorise le micro pour t'enregistrer.");
      return false;
    }
    if (mediaStreamRef.current) demarrerCapture(mediaStreamRef.current);

    stoppingRef.current = false;
    finalRef.current = "";
    confSumRef.current = 0;
    confWeightRef.current = 0;
    resultatsRecusRef.current = false;
    redemarragesRef.current = 0;
    setFinalText("");
    setInterimText("");
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);

    // Pas de dictée native, ou une dictée qui a déjà prouvé son silence
    // (le cas Samsung) : segments serveur directement.
    if (!Ctor || segmentsPrefere) {
      tournerSegments();
      setPhase("recording");
      return true;
    }

    const rec = new Ctor();
    rec.lang = langue;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev) => {
      resultatsRecusRef.current = true;
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
      // Service indisponible ou langue refusée : la permission est bonne mais
      // le service natif ne rendra rien — le repli serveur prend la suite.
      if (ev.error === "service-not-allowed" || ev.error === "language-not-supported") return basculerSurSegments();
      if (ev.error === "network" && !resultatsRecusRef.current) return basculerSurSegments();
      // "no-speech" / "aborted" : cycle de vie normal ; "network" : micro-coupure
      // du service de reconnaissance, onend suit et on redémarre seul.
      if (ev.error !== "no-speech" && ev.error !== "aborted" && ev.error !== "network") {
        setError(`Reconnaissance vocale : ${ev.error}`);
      }
    };

    rec.onend = () => {
      if (!stoppingRef.current && recognitionRef.current === rec) {
        redemarragesRef.current += 1;
        // Des fins en rafale sans le moindre mot : le service ne marche pas
        // vraiment ici — repli plutôt que de mouliner en silence.
        if (redemarragesRef.current > 4 && finalRef.current.trim() === "") return basculerSurSegments();
        try {
          rec.start();
        } catch {
          /* déjà relancée */
        }
      }
    };

    recognitionRef.current = rec;
    rec.start();
    // Démarrée mais muette : sur certains Android, la dictée « écoute » sans
    // jamais rendre un mot. Douze secondes sans le moindre résultat (même
    // provisoire), et le repli serveur prend la suite.
    basculeTimerRef.current = setTimeout(() => {
      if (!resultatsRecusRef.current && recognitionRef.current === rec) basculerSurSegments();
    }, 12_000);
    setPhase("recording");
    return true;
  }

  function stop() {
    stoppingRef.current = true;
    recognitionRef.current?.stop();
    arreterSegments();
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
    attendreTranscription: async () => {
      const debut = Date.now();
      while ((!flushFaitRef.current || enVolRef.current > 0) && Date.now() - debut < 8_000) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return finalRef.current.trim();
    },
    audioBlob: () => blobRef.current,
    mesuresAudio: () => mesuresRef.current,
  };
}
