/**
 * Répétition avec ses slides : le temps passé sur chaque diapositive,
 * comparé au minutage prévu. Fonctions pures — la page ne fait qu'enregistrer
 * des segments (« de t1 à t2, la diapositive n était affichée ») et afficher.
 */

import type { Deck } from "../slides/types";
import type { Pitch } from "../pitch";
import type { SlideTiming } from "../types";

/** Un passage sur une diapositive pendant l'enregistrement. */
export interface Segment {
  numero: number;
  debutMs: number;
  finMs: number;
}

/** Cumule les segments par diapositive (on peut revenir en arrière). */
export function cumulerSegments(segments: Segment[]): SlideTiming[] {
  const parNumero = new Map<number, number>();
  for (const s of segments) {
    const duree = Math.max(0, s.finMs - s.debutMs);
    parNumero.set(s.numero, (parNumero.get(s.numero) ?? 0) + duree);
  }
  return [...parNumero.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, dureeMs]) => ({ numero, dureeMs }));
}

export type SourcePrevu = "pitch" | "uniforme";

/**
 * Minutage prévu par diapositive. Avec un pitch généré pour cette durée, on
 * prend ses secondes ; sinon une répartition uniforme, dite comme telle —
 * un chiffre dont on ne connaît pas l'origine ne vaut rien.
 */
export function planPrevu(deck: Deck, pitch: Pitch | null, dureeMs: number): { source: SourcePrevu; prevu: SlideTiming[] } {
  if (pitch && pitch.slides.length === deck.slides.length) {
    return {
      source: "pitch",
      prevu: pitch.slides.map((s) => ({ numero: s.numero, dureeMs: Math.round(s.secondes * 1000) })),
    };
  }
  const part = Math.round(dureeMs / Math.max(1, deck.slides.length));
  return { source: "uniforme", prevu: deck.slides.map((s) => ({ numero: s.numero, dureeMs: part })) };
}

export type Niveau = "bon" | "attention" | "alerte" | "non-vue";

export interface LigneComparaison {
  numero: number;
  titre: string;
  prevuMs: number;
  reelMs: number;
  /** Écart relatif au prévu : +0.5 = 50 % trop long. */
  ecart: number;
  niveau: Niveau;
}

export interface Comparaison {
  lignes: LigneComparaison[];
  totalPrevuMs: number;
  totalReelMs: number;
  /** Diapositives jamais affichées. */
  nonVues: number[];
  /** La diapositive la plus en dépassement (si une dépasse de plus de 20 %). */
  pireDepassement: LigneComparaison | null;
  resume: string;
}

/** Seuils d'écart relatif — exportés pour rester critiquables. */
export const SEUILS_REPETITION = { bon: 0.2, attention: 0.5 } as const;

function niveauPour(prevuMs: number, reelMs: number): Niveau {
  if (reelMs === 0) return "non-vue";
  if (prevuMs === 0) return "attention";
  const e = Math.abs(reelMs - prevuMs) / prevuMs;
  return e <= SEUILS_REPETITION.bon ? "bon" : e <= SEUILS_REPETITION.attention ? "attention" : "alerte";
}

function secondes(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

export function comparer(deck: Deck, prevu: SlideTiming[], reel: SlideTiming[]): Comparaison {
  const reelPar = new Map(reel.map((r) => [r.numero, r.dureeMs]));
  const prevuPar = new Map(prevu.map((p) => [p.numero, p.dureeMs]));
  const lignes: LigneComparaison[] = deck.slides.map((s) => {
    const prevuMs = prevuPar.get(s.numero) ?? 0;
    const reelMs = reelPar.get(s.numero) ?? 0;
    const ecart = prevuMs > 0 ? (reelMs - prevuMs) / prevuMs : 0;
    return { numero: s.numero, titre: s.titre, prevuMs, reelMs, ecart, niveau: niveauPour(prevuMs, reelMs) };
  });
  const totalPrevuMs = lignes.reduce((a, l) => a + l.prevuMs, 0);
  const totalReelMs = lignes.reduce((a, l) => a + l.reelMs, 0);
  const nonVues = lignes.filter((l) => l.niveau === "non-vue").map((l) => l.numero);
  const depassements = lignes.filter((l) => l.niveau !== "non-vue" && l.ecart > SEUILS_REPETITION.bon);
  const pireDepassement = depassements.length
    ? depassements.reduce((a, b) => (b.ecart > a.ecart ? b : a))
    : null;

  const parts: string[] = [];
  if (nonVues.length > 0) {
    parts.push(
      nonVues.length === 1
        ? `La diapositive ${nonVues[0]} n'a pas été montrée.`
        : `${nonVues.length} diapositives n'ont pas été montrées (${nonVues.join(", ")}).`,
    );
  }
  if (pireDepassement) {
    parts.push(
      `La diapositive ${pireDepassement.numero} a pris ${secondes(pireDepassement.reelMs)} pour ${secondes(pireDepassement.prevuMs)} prévues : c'est là que le temps part.`,
    );
  }
  const bonnes = lignes.filter((l) => l.niveau === "bon").length;
  const expediees = lignes.filter((l) => l.niveau === "alerte" && l.ecart < 0);
  if (parts.length === 0) {
    if (bonnes === lignes.length) {
      parts.push("Chaque diapositive est dans son temps. C'est ce que le jury ressent comme de la maîtrise.");
    } else if (expediees.length > 0) {
      parts.push(
        (expediees.length === 1
          ? `La diapositive ${expediees[0].numero} a été expédiée bien plus vite que prévu`
          : `${expediees.length} diapositives ont été expédiées bien plus vite que prévu (${expediees.map((l) => l.numero).join(", ")})`) +
          " : soit tu survoles, soit le minutage prévu est trop généreux — vérifie ton pitch.",
      );
    } else {
      parts.push("Aucun gros dérapage : ajuste les diapositives en orange et c'est bon.");
    }
  } else {
    parts.push(`${bonnes}/${lignes.length} diapositives dans leur temps.`);
  }

  return { lignes, totalPrevuMs, totalReelMs, nonVues, pireDepassement, resume: parts.join(" ") };
}

/** Pour l'affichage pendant la répétition : où en est-on sur la diapositive courante. */
export function etatSlide(reelMs: number, prevuMs: number): "dans-les-temps" | "proche" | "depasse" {
  if (prevuMs <= 0) return "dans-les-temps";
  const r = reelMs / prevuMs;
  return r > 1 + SEUILS_REPETITION.bon ? "depasse" : r > 0.9 ? "proche" : "dans-les-temps";
}
