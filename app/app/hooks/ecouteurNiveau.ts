"use client";

import { PAS_ECHANTILLON_MS } from "@/lib/decoupe-voix";

/**
 * L'oreille qui mesure le niveau du micro pendant un segment : un analyseur
 * Web Audio échantillonne le RMS toutes les 100 ms. Les hooks d'écoute s'en
 * servent avec lib/decoupe-voix pour couper aux pauses, pas en plein mot.
 * Sans Web Audio, retourne null — l'appelant garde sa minuterie fixe.
 */
export interface EcouteurNiveau {
  /** Remet à zéro la fenêtre : à appeler au début de chaque segment. */
  nouveauSegment(): void;
  /** Les niveaux du segment courant (un point par 100 ms). */
  niveaux(): number[];
  fermer(): void;
}

export function creerEcouteurNiveau(flux: MediaStream): EcouteurNiveau | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(flux);
    const analyseur = ctx.createAnalyser();
    analyseur.fftSize = 1024;
    source.connect(analyseur);
    const tampon = new Float32Array(analyseur.fftSize);
    let courants: number[] = [];
    const timer = setInterval(() => {
      analyseur.getFloatTimeDomainData(tampon);
      let somme = 0;
      for (let i = 0; i < tampon.length; i++) somme += tampon[i]! * tampon[i]!;
      courants.push(Math.sqrt(somme / tampon.length));
    }, PAS_ECHANTILLON_MS);
    return {
      nouveauSegment: () => {
        courants = [];
      },
      niveaux: () => courants,
      fermer: () => {
        clearInterval(timer);
        void ctx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}
