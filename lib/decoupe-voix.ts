/**
 * La décision de découpe d'un segment d'écoute, à partir des niveaux sonores
 * (RMS, un échantillon toutes les 100 ms). La découpe aveugle toutes les 3 s
 * coupait en plein mot — mots manquants, mots déformés aux frontières, et
 * des segments de pur silence envoyés au serveur où Whisper hallucine.
 * Ici : on coupe quand la personne FAIT UNE PAUSE, jamais en plein mot ;
 * un segment sans parole ne mérite pas de voyage au serveur.
 *
 * Les seuils sont ADAPTATIFS : un seuil fixe (0,012 à la première version)
 * classait « silence » la voix des micros de téléphone, dont la réduction de
 * bruit écrase les niveaux. Le seuil de parole se cale sur le bruit de fond
 * réel de la fenêtre (quantile bas), avec un plancher prudent.
 * Fonctions pures — les tests les couvrent sans micro.
 */

export const PAS_ECHANTILLON_MS = 100;

/** Il faut au moins ~300 ms au-dessus du seuil pour dire « ça parle ». */
const ECHANTILLONS_PAROLE = 3;
/** Une pause = ~600 ms sous le seuil de silence relatif au pic du segment. */
const ECHANTILLONS_PAUSE = 6;
const RATIO_SILENCE = 0.18;
/** Un segment ne dépasse jamais 8 s (limite de fiabilité de MediaRecorder mobile). */
const DUREE_MAX_MS = 8_000;
/** Sans parole, on recycle le segment au bout de 4 s. */
const DUREE_SILENCE_MS = 4_000;
/** On ne coupe pas un mot de moins de 1,5 s. */
const DUREE_MIN_MS = 1_500;

export interface MesuresFenetre {
  pic: number;
  plancher: number;
  seuilParole: number;
  parle: boolean;
}

/** Le bruit de fond (quantile bas) et le seuil de parole qui s'y adapte. */
export function mesurerFenetre(niveaux: number[]): MesuresFenetre {
  if (niveaux.length === 0) return { pic: 0, plancher: 0, seuilParole: 0.006, parle: false };
  const tri = [...niveaux].sort((a, b) => a - b);
  const plancher = tri[Math.floor(tri.length * 0.2)] ?? 0;
  // Plafonné : quand la personne parle sans pause de toute la fenêtre, le
  // « bruit de fond » mesuré est sa propre voix — sans plafond, le seuil
  // s'envolerait et classerait silence un discours continu.
  const seuilParole = Math.max(0.006, Math.min(0.012, plancher * 2.5 + 0.002));
  let n = 0;
  for (const v of niveaux) if (v > seuilParole) n += 1;
  return { pic: tri[tri.length - 1] ?? 0, plancher, seuilParole, parle: n >= ECHANTILLONS_PAROLE };
}

export function contientParole(niveaux: number[]): boolean {
  return mesurerFenetre(niveaux).parle;
}

export type DecisionDecoupe = "continuer" | "couper" | "couper-silence";

export function decouper(niveaux: number[]): DecisionDecoupe {
  const dureeMs = niveaux.length * PAS_ECHANTILLON_MS;
  const { pic, plancher, seuilParole, parle } = mesurerFenetre(niveaux);
  if (dureeMs >= DUREE_MAX_MS) return parle ? "couper" : "couper-silence";
  if (!parle) return dureeMs >= DUREE_SILENCE_MS ? "couper-silence" : "continuer";
  if (dureeMs < DUREE_MIN_MS) return "continuer";
  // Le plancher sert aussi ici, borné pour la même raison que le seuil de
  // parole : en discours continu, le « bruit de fond » mesuré est la voix.
  const plancherBruit = Math.min(plancher, seuilParole * 0.7);
  const seuilSilence = Math.max(plancherBruit * 1.8 + 0.001, pic * RATIO_SILENCE);
  const queue = niveaux.slice(-ECHANTILLONS_PAUSE);
  if (queue.length === ECHANTILLONS_PAUSE && queue.every((v) => v < seuilSilence)) return "couper";
  return "continuer";
}
