"use client";

import { useCallback, useRef, useState } from "react";
import { analyserImages, type BilanCamera, type ImageVisage } from "@/lib/camera";

/**
 * La caméra pendant l'oral : MediaPipe Face Landmarker tourne dans le
 * navigateur, cinq images par seconde, et n'en garde que des nombres
 * (angles de tête, regard, sourire). L'image n'est jamais envoyée nulle
 * part, jamais enregistrée — elle sert d'aperçu et disparaît.
 *
 * Le modèle (~3 Mo) et le moteur WebAssembly sont chargés à la demande,
 * seulement si la personne allume la caméra.
 */

const IMAGES_PAR_SECONDE = 5;
/** Servi depuis notre domaine (copié au build par scripts/mediapipe.mjs). */
const WASM = "/mediapipe/wasm";
const MODELE = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type EtatCamera = "eteinte" | "chargement" | "active" | "refusee" | "indisponible";

interface Forme {
  categoryName?: string;
  score: number;
}

/** Degrés depuis la matrice de transformation faciale (lacet, tangage). */
function anglesDepuisMatrice(m: number[]): { lacetDeg: number; tangageDeg: number } {
  // Matrice colonne-major 4×4 ; on lit la rotation.
  const r02 = m[8] ?? 0;
  const r12 = m[9] ?? 0;
  const r22 = m[10] ?? 1;
  const lacet = Math.atan2(r02, r22) * (180 / Math.PI);
  const tangage = Math.atan2(-r12, Math.hypot(r02, r22)) * (180 / Math.PI);
  return { lacetDeg: lacet, tangageDeg: tangage };
}

function valeur(formes: Forme[], nom: string): number {
  return formes.find((f) => f.categoryName === nom)?.score ?? 0;
}

export interface Camera {
  etat: EtatCamera;
  /** Le flux à brancher sur un <video> d'aperçu. */
  flux: MediaStream | null;
  allumer: (video: HTMLVideoElement) => Promise<boolean>;
  eteindre: () => void;
  /** Le bilan de ce qui a été observé, puis remise à zéro. */
  recolter: () => BilanCamera | null;
  /** Nombre d'images analysées jusqu'ici (pour l'affichage en direct). */
  imagesRef: React.RefObject<number>;
}

export function useCamera(): Camera {
  const [etat, setEtat] = useState<EtatCamera>("eteinte");
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const detecteurRef = useRef<{ detectForVideo: (v: HTMLVideoElement, t: number) => unknown; close?: () => void } | null>(null);
  const boucleRef = useRef<number | null>(null);
  const imagesRef = useRef<ImageVisage[]>([]);
  const compteurRef = useRef(0);
  const debutRef = useRef(0);

  const eteindre = useCallback(() => {
    if (boucleRef.current !== null) {
      cancelAnimationFrame(boucleRef.current);
      boucleRef.current = null;
    }
    setFlux((f) => {
      f?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setEtat("eteinte");
  }, []);

  const allumer = useCallback(
    async (video: HTMLVideoElement): Promise<boolean> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEtat("indisponible");
        return false;
      }
      setEtat("chargement");
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      } catch {
        setEtat("refusee");
        return false;
      }
      try {
        const charger = async () => {
          const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
          const fileset = await FilesetResolver.forVisionTasks(WASM);
          return (await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODELE, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
          })) as unknown as { detectForVideo: (v: HTMLVideoElement, t: number) => unknown };
        };
        // Le modèle fait ~3,7 Mo : au-delà de 20 s, on renonce plutôt que de faire attendre.
        detecteurRef.current ??= await Promise.race([
          charger(),
          new Promise<never>((_, rejeter) => setTimeout(() => rejeter(new Error("délai dépassé")), 20_000)),
        ]);
      } catch (e) {
        console.warn("[camera] moteur indisponible", e);
        media.getTracks().forEach((t) => t.stop());
        setEtat("indisponible");
        return false;
      }

      video.srcObject = media;
      await video.play().catch(() => {});
      // Sans dimensions, detectForVideo lève à chaque image.
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          const pret = () => resolve();
          video.addEventListener("loadeddata", pret, { once: true });
          setTimeout(pret, 3000);
        });
      }
      setFlux(media);
      setEtat("active");
      imagesRef.current = [];
      compteurRef.current = 0;
      debutRef.current = performance.now();

      let dernier = 0;
      const boucler = () => {
        boucleRef.current = requestAnimationFrame(boucler);
        const maintenant = performance.now();
        if (maintenant - dernier < 1000 / IMAGES_PAR_SECONDE) return;
        dernier = maintenant;
        const d = detecteurRef.current;
        if (!d || video.readyState < 2) return;
        try {
          const res = d.detectForVideo(video, maintenant) as {
            faceBlendshapes?: Array<{ categories: Forme[] }>;
            facialTransformationMatrixes?: Array<{ data: number[] }>;
          };
          const tMs = Math.round(maintenant - debutRef.current);
          const formes = res.faceBlendshapes?.[0]?.categories;
          const matrice = res.facialTransformationMatrixes?.[0]?.data;
          if (!formes || !matrice) {
            imagesRef.current.push({ tMs, visage: false });
          } else {
            const { lacetDeg, tangageDeg } = anglesDepuisMatrice(matrice);
            imagesRef.current.push({
              tMs,
              visage: true,
              lacetDeg,
              tangageDeg,
              // Regard : combinaison des blendshapes ARKit gauche/droite.
              regardHorizontal: (valeur(formes, "eyeLookOutLeft") + valeur(formes, "eyeLookInRight")) / 2 - (valeur(formes, "eyeLookInLeft") + valeur(formes, "eyeLookOutRight")) / 2,
              regardVertical: (valeur(formes, "eyeLookUpLeft") + valeur(formes, "eyeLookUpRight")) / 2 - (valeur(formes, "eyeLookDownLeft") + valeur(formes, "eyeLookDownRight")) / 2,
              sourire: (valeur(formes, "mouthSmileLeft") + valeur(formes, "mouthSmileRight")) / 2,
              yeuxFermes: (valeur(formes, "eyeBlinkLeft") + valeur(formes, "eyeBlinkRight")) / 2,
            });
          }
          compteurRef.current = imagesRef.current.length;
        } catch {
          /* une image ratée n'arrête pas l'oral */
        }
      };
      boucler();
      return true;
    },
    [],
  );

  const recolter = useCallback((): BilanCamera | null => {
    const images = imagesRef.current;
    imagesRef.current = [];
    compteurRef.current = 0;
    if (images.length === 0) return null;
    return analyserImages(images);
  }, []);

  return { etat, flux, allumer, eteindre, recolter, imagesRef: compteurRef };
}
