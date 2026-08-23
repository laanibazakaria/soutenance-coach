"use client";

import { useCallback, useRef } from "react";

/**
 * L'écoute pour les navigateurs sans reconnaissance vocale (Firefox, Safari,
 * mobiles) : le micro est enregistré par segments autonomes de ~3,5 s
 * (MediaRecorder redémarré à chaque fois — un fragment de timeslice n'est
 * pas un fichier lisible), chaque segment part en transcription, et deux
 * segments vides d'affilée après de la parole signifient « réponse finie ».
 */
export interface EcouteSegments {
  demarrer: (args: { langue: "fr" | "en"; surTexte: (texte: string) => void; surFin: () => void }) => Promise<boolean>;
  arreter: () => void;
  disponible: () => boolean;
}

const SEGMENT_MS = 3_500;
const SILENCES_POUR_FINIR = 2;

export function useEcouteSegments(): EcouteSegments {
  const fluxRef = useRef<MediaStream | null>(null);
  const enregistreurRef = useRef<MediaRecorder | null>(null);
  const arreteRef = useRef(false);

  const arreter = useCallback(() => {
    arreteRef.current = true;
    try {
      enregistreurRef.current?.stop();
    } catch {
      /* déjà arrêté */
    }
    enregistreurRef.current = null;
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
  }, []);

  const demarrer = useCallback(
    async ({ langue, surTexte, surFin }: { langue: "fr" | "en"; surTexte: (texte: string) => void; surFin: () => void }): Promise<boolean> => {
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
      arreteRef.current = false;
      try {
        fluxRef.current ??= await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return false;
      }
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      let silences = 0;
      let aParle = false;

      const tourner = () => {
        if (arreteRef.current || !fluxRef.current) return;
        const enr = new MediaRecorder(fluxRef.current, type ? { mimeType: type } : undefined);
        enregistreurRef.current = enr;
        const morceaux: Blob[] = [];
        enr.ondataavailable = (e) => {
          if (e.data.size > 0) morceaux.push(e.data);
        };
        enr.onstop = () => {
          if (arreteRef.current) return;
          const blob = new Blob(morceaux, { type: type ?? "audio/webm" });
          // Le segment suivant démarre tout de suite : pas de trou d'écoute pendant la transcription.
          tourner();
          const fd = new FormData();
          fd.append("audio", blob, "segment.webm");
          fd.append("langue", langue);
          fetch("/api/transcrire", { method: "POST", body: fd })
            .then((r) => (r.ok ? (r.json() as Promise<{ texte?: string }>) : { texte: "" }))
            .then(({ texte }) => {
              if (arreteRef.current) return;
              const propre = (texte ?? "").trim();
              if (propre) {
                aParle = true;
                silences = 0;
                surTexte(propre);
              } else if (aParle && ++silences >= SILENCES_POUR_FINIR) {
                arreter();
                surFin();
              }
            })
            .catch(() => {
              /* segment perdu : le suivant compensera */
            });
        };
        enr.start();
        setTimeout(() => {
          try {
            if (enr.state === "recording") enr.stop();
          } catch {
            /* déjà arrêté */
          }
        }, SEGMENT_MS);
      };
      tourner();
      return true;
    },
    [arreter],
  );

  const disponible = useCallback(() => typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia), []);

  return { demarrer, arreter, disponible };
}
