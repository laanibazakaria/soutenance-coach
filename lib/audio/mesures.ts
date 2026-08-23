/**
 * Mesures sur le son — calculées à partir d'échantillons d'intensité (RMS)
 * pris toutes les ~100 ms pendant l'enregistrement. Pur et testé : la
 * capture est dans le hook, le calcul est ici.
 */

export interface MesuresAudio {
  /** Nombre de silences de plus de `pauseLongueMs`. */
  pausesLongues: number;
  /** Durée du plus long silence, en ms. */
  plusLonguePauseMs: number;
  /** Part du temps passé en silence (0..1), hors début et fin. */
  partSilence: number;
  /** Variation de l'intensité quand on parle (coefficient de variation, 0..~1). Bas = monotone. */
  dynamique: number;
}

export const SEUILS_AUDIO = {
  /** Un silence compte à partir de cette durée. */
  pauseLongueMs: 1500,
  /** En dessous de ce coefficient de variation, la voix est jugée monotone. */
  dynamiqueFaible: 0.25,
  /** Part de silence au-delà de laquelle on le signale. */
  partSilenceElevee: 0.3,
} as const;

/**
 * Seuil de silence : adaptatif — un peu au-dessus du bruit de fond (le 15e
 * centile des échantillons), borné pour ne pas compter le souffle comme de la
 * parole.
 */
export function seuilSilence(rms: number[]): number {
  if (rms.length === 0) return 0;
  const tries = [...rms].sort((a, b) => a - b);
  const plancher = tries[Math.floor(tries.length * 0.15)] ?? 0;
  const median = tries[Math.floor(tries.length * 0.5)] ?? 0;
  return Math.max(plancher * 2.5, median * 0.25, 0.005);
}

export function mesurerAudio(rms: number[], pasMs: number): MesuresAudio | null {
  if (rms.length < 20) return null;
  const seuil = seuilSilence(rms);
  const parle = rms.map((v) => v > seuil);
  // On ignore le silence initial (le temps de commencer) et final (le temps d'arrêter).
  let debut = parle.indexOf(true);
  let fin = parle.lastIndexOf(true);
  if (debut === -1 || fin <= debut) return { pausesLongues: 0, plusLonguePauseMs: 0, partSilence: 1, dynamique: 0 };
  let pausesLongues = 0;
  let plusLongue = 0;
  let silenceTotal = 0;
  let courante = 0;
  for (let i = debut; i <= fin; i++) {
    if (!parle[i]) {
      courante += pasMs;
    } else {
      if (courante >= SEUILS_AUDIO.pauseLongueMs) pausesLongues++;
      plusLongue = Math.max(plusLongue, courante);
      silenceTotal += courante;
      courante = 0;
    }
  }
  const duree = (fin - debut + 1) * pasMs;
  const voix = rms.slice(debut, fin + 1).filter((v) => v > seuil);
  const moyenne = voix.reduce((a, b) => a + b, 0) / Math.max(1, voix.length);
  const variance = voix.reduce((a, b) => a + (b - moyenne) ** 2, 0) / Math.max(1, voix.length);
  const dynamique = moyenne > 0 ? Math.sqrt(variance) / moyenne : 0;
  return { pausesLongues, plusLonguePauseMs: plusLongue, partSilence: duree > 0 ? silenceTotal / duree : 0, dynamique: Math.round(dynamique * 100) / 100 };
}

export interface ConstatAudio {
  id: "pauses" | "dynamique";
  niveau: "bon" | "attention";
  message: string;
}

/** La lecture humaine des mesures. Pas de note : des faits et un conseil. */
export function constatsAudio(m: MesuresAudio): ConstatAudio[] {
  const s = Math.round(m.plusLonguePauseMs / 1000);
  const pauses: ConstatAudio =
    m.pausesLongues === 0
      ? { id: "pauses", niveau: "bon", message: "Aucun blanc de plus d'une seconde et demie : le fil ne casse jamais." }
      : m.partSilence > SEUILS_AUDIO.partSilenceElevee
        ? { id: "pauses", niveau: "attention", message: `${m.pausesLongues} blanc${m.pausesLongues > 1 ? "s" : ""} de plus de 1,5 s, le plus long ${s} s — près d'un tiers du temps en silence. Un blanc court est une respiration ; trop, c'est une hésitation que le jury entend.` }
        : { id: "pauses", niveau: "bon", message: `${m.pausesLongues} blanc${m.pausesLongues > 1 ? "s" : ""} de plus de 1,5 s, le plus long ${s} s. Des respirations, pas des trous : c'est bien.` };
  const dynamique: ConstatAudio =
    m.dynamique < SEUILS_AUDIO.dynamiqueFaible
      ? { id: "dynamique", niveau: "attention", message: "Voix très régulière en intensité : ça s'entend comme de la monotonie. Appuie les mots qui comptent, baisse sur les transitions." }
      : { id: "dynamique", niveau: "bon", message: "L'intensité varie : ta voix porte les idées au lieu de les lire." };
  return [pauses, dynamique];
}
