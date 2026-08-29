"use client";

import { useCallback, useRef } from "react";
import { decouper } from "@/lib/decoupe-voix";
import { creerEcouteurNiveau, type EcouteurNiveau } from "./ecouteurNiveau";

/**
 * L'écoute pour les navigateurs sans reconnaissance vocale (Firefox, Safari,
 * mobiles) : le micro est enregistré par segments autonomes (MediaRecorder
 * redémarré à chaque fois — un fragment de timeslice n'est pas un fichier
 * lisible), chaque segment part en transcription, et deux silences d'affilée
 * après de la parole signifient « réponse finie ».
 *
 * La coupe suit la VOIX, pas la montre : un analyseur mesure le niveau du
 * micro et le segment se ferme à la pause (jamais en plein mot), avec un
 * plafond de 8 s. Un segment sans parole ne part pas au serveur — c'est là
 * que Whisper hallucine, et c'est du temps perdu.
 */
export interface EcouteSegments {
  demarrer: (args: { langue: "fr" | "en"; surTexte: (texte: string) => void; surFin: () => void }) => Promise<boolean>;
  arreter: () => void;
  disponible: () => boolean;
}

/** Sans Web Audio (pas d'analyseur), on retombe sur une minuterie fixe. */
const SEGMENT_FIXE_MS = 4_000;
const FILET_MS = 8_300;
const SILENCES_POUR_FINIR = 2;

export function useEcouteSegments(): EcouteSegments {
  const fluxRef = useRef<MediaStream | null>(null);
  const enregistreurRef = useRef<MediaRecorder | null>(null);
  const ecouteurRef = useRef<EcouteurNiveau | null>(null);
  const arreteRef = useRef(false);

  const arreter = useCallback(() => {
    arreteRef.current = true;
    try {
      enregistreurRef.current?.stop();
    } catch {
      /* déjà arrêté */
    }
    enregistreurRef.current = null;
    ecouteurRef.current?.fermer();
    ecouteurRef.current = null;
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
      ecouteurRef.current ??= creerEcouteurNiveau(fluxRef.current);
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      let silences = 0;
      let aParle = false;
      // La fin du texte déjà transcrit, soufflée à Whisper : les phrases se
      // recollent d'un segment à l'autre au lieu de repartir de zéro.
      let dejaDit = "";

      const compterSilence = () => {
        if (aParle && ++silences >= SILENCES_POUR_FINIR) {
          arreter();
          surFin();
        }
      };

      const tourner = () => {
        if (arreteRef.current || !fluxRef.current) return;
        const enr = new MediaRecorder(fluxRef.current, type ? { mimeType: type } : undefined);
        enregistreurRef.current = enr;
        const morceaux: Blob[] = [];
        enr.ondataavailable = (e) => {
          if (e.data.size > 0) morceaux.push(e.data);
        };

        const ecouteur = ecouteurRef.current;
        ecouteur?.nouveauSegment();
        // Sans analyseur, on suppose la parole : tout part au serveur.
        let contenaitParole = true;
        let garde: ReturnType<typeof setInterval> | null = null;
        const fermerSegment = () => {
          if (garde) clearInterval(garde);
          garde = null;
          clearTimeout(filet);
          try {
            if (enr.state === "recording") enr.stop();
          } catch {
            /* déjà arrêté */
          }
        };
        if (ecouteur) {
          garde = setInterval(() => {
            const decision = decouper(ecouteur.niveaux());
            if (decision === "continuer") return;
            contenaitParole = decision === "couper";
            fermerSegment();
          }, 120);
        }
        const filet = setTimeout(fermerSegment, ecouteur ? FILET_MS : SEGMENT_FIXE_MS);

        enr.onstop = () => {
          if (garde) clearInterval(garde);
          clearTimeout(filet);
          if (arreteRef.current) return;
          // Le segment suivant démarre tout de suite : pas de trou d'écoute.
          tourner();
          if (!contenaitParole) return compterSilence();
          const blob = new Blob(morceaux, { type: type ?? "audio/webm" });
          if (blob.size < 200) return compterSilence();
          const fd = new FormData();
          fd.append("audio", blob, "segment.webm");
          fd.append("langue", langue);
          if (dejaDit) fd.append("precedent", dejaDit.slice(-240));
          fetch("/api/transcrire", { method: "POST", body: fd })
            .then((r) => (r.ok ? (r.json() as Promise<{ texte?: string }>) : { texte: "" }))
            .then(({ texte }) => {
              if (arreteRef.current) return;
              const propre = (texte ?? "").trim();
              if (propre) {
                aParle = true;
                silences = 0;
                dejaDit = `${dejaDit} ${propre}`.slice(-600);
                surTexte(propre);
              } else {
                compterSilence();
              }
            })
            .catch(() => {
              /* segment perdu : le suivant compensera */
            });
        };
        enr.start();
      };
      tourner();
      return true;
    },
    [arreter],
  );

  const disponible = useCallback(() => typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia), []);

  return { demarrer, arreter, disponible };
}
