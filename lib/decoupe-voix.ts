/**
 * La décision de découpe d'un segment d'écoute, à partir des niveaux sonores
 * (RMS, un échantillon toutes les 100 ms). La découpe aveugle toutes les 3 s
 * coupait en plein mot — mots manquants, mots déformés aux frontières, et
 * des segments de pur silence envoyés au serveur où Whisper hallucine.
 * Ici : on coupe quand la personne FAIT UNE PAUSE, jamais en plein mot ;
 * un segment sans parole ne mérite pas de voyage au serveur.
 * Fonction pure — les tests la couvrent sans micro.
 */

export const PAS_ECHANTILLON_MS = 100;

/** En dessous, ce n'est pas de la parole (bruit de fond d'un téléphone). */
const SEUIL_PAROLE = 0.012;
/** Il faut au moins ~300 ms au-dessus du seuil pour dire « ça parle ». */
const ECHANTILLONS_PAROLE = 3;
/** Une pause = ~600 ms sous le seuil de silence relatif au pic du segment. */
const ECHANTILLONS_PAUSE = 6;
const PLANCHER_SILENCE = 0.005;
const RATIO_SILENCE = 0.18;
/** Un segment ne dépasse jamais 8 s (limite de fiabilité de MediaRecorder mobile). */
const DUREE_MAX_MS = 8_000;
/** Sans parole, on recycle le segment au bout de 4 s. */
const DUREE_SILENCE_MS = 4_000;
/** On ne coupe pas un mot de moins de 1,5 s. */
const DUREE_MIN_MS = 1_500;

export type DecisionDecoupe = "continuer" | "couper" | "couper-silence";

export function contientParole(niveaux: number[]): boolean {
  let n = 0;
  for (const v of niveaux) if (v > SEUIL_PAROLE) n += 1;
  return n >= ECHANTILLONS_PAROLE;
}

export function decouper(niveaux: number[]): DecisionDecoupe {
  const dureeMs = niveaux.length * PAS_ECHANTILLON_MS;
  const parle = contientParole(niveaux);
  if (dureeMs >= DUREE_MAX_MS) return parle ? "couper" : "couper-silence";
  if (!parle) return dureeMs >= DUREE_SILENCE_MS ? "couper-silence" : "continuer";
  if (dureeMs < DUREE_MIN_MS) return "continuer";
  const pic = Math.max(...niveaux);
  const seuil = Math.max(PLANCHER_SILENCE, pic * RATIO_SILENCE);
  const queue = niveaux.slice(-ECHANTILLONS_PAUSE);
  if (queue.length === ECHANTILLONS_PAUSE && queue.every((v) => v < seuil)) return "couper";
  return "continuer";
}
