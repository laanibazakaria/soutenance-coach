/**
 * Détection des mots et expressions béquilles du français oral.
 *
 * Liste issue de l'observation de sessions réelles (dont la toute première
 * session de test du projet : « ouais », « donc », « du coup », « en effet »,
 * « et voilà »…) et des béquilles classiques de l'oral académique.
 *
 * Règles de comptage :
 * - insensible à la casse et robuste aux ponctuations collées (« donc, » compte) ;
 * - les expressions multi-mots sont détectées en premier et consomment leurs
 *   mots (« et voilà » ne compte pas aussi un « voilà ») ;
 * - variantes orthographiques regroupées (« euh »/« heu » → « euh »).
 */

/** Expressions multi-mots, détectées en priorité. La clé est la forme canonique. */
const MULTI_WORD: ReadonlyArray<readonly [canonical: string, words: readonly string[]]> = [
  ["et voilà", ["et", "voilà"]],
  ["du coup", ["du", "coup"]],
  ["en fait", ["en", "fait"]],
  ["en effet", ["en", "effet"]],
  ["tu vois", ["tu", "vois"]],
  ["vous voyez", ["vous", "voyez"]],
  ["comment dire", ["comment", "dire"]],
  ["grosso modo", ["grosso", "modo"]],
  ["au final", ["au", "final"]],
  ["pour le coup", ["pour", "le", "coup"]],
];

/** Mots simples. La clé est la forme rencontrée, la valeur la forme canonique. */
const SINGLE_WORD: ReadonlyMap<string, string> = new Map([
  ["euh", "euh"],
  ["heu", "euh"],
  ["hem", "euh"],
  ["ben", "ben"],
  ["bah", "ben"],
  ["ouais", "ouais"],
  ["genre", "genre"],
  ["bref", "bref"],
  ["hein", "hein"],
  ["voilà", "voilà"],
  ["donc", "donc"],
  ["alors", "alors"],
  ["effectivement", "effectivement"],
  ["justement", "justement"],
  ["carrément", "carrément"],
]);

export interface FillerCount {
  /** Forme canonique de la béquille. */
  filler: string;
  /** Nombre d'occurrences. */
  count: number;
}

/** Normalise un mot : minuscules, ponctuation périphérique retirée. */
function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

/** Découpe une transcription en mots normalisés (les vides sont retirés). */
export function tokenize(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w !== "");
}

/**
 * Compte les béquilles d'une transcription.
 * Retourne les occurrences triées par fréquence décroissante puis ordre alphabétique
 * (ordre déterministe — exigence de la fiche de mission).
 */
export function countFillers(transcript: string): FillerCount[] {
  const words = tokenize(transcript);
  const consumed = new Array<boolean>(words.length).fill(false);
  const counts = new Map<string, number>();

  const bump = (canonical: string) => counts.set(canonical, (counts.get(canonical) ?? 0) + 1);

  // 1. Expressions multi-mots (consomment leurs mots).
  for (let i = 0; i < words.length; i++) {
    if (consumed[i]) continue;
    for (const [canonical, sequence] of MULTI_WORD) {
      if (i + sequence.length > words.length) continue;
      let match = true;
      for (let j = 0; j < sequence.length; j++) {
        if (consumed[i + j] || words[i + j] !== sequence[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < sequence.length; j++) consumed[i + j] = true;
        bump(canonical);
        break;
      }
    }
  }

  // 2. Mots simples sur ce qui reste.
  for (let i = 0; i < words.length; i++) {
    if (consumed[i]) continue;
    const canonical = SINGLE_WORD.get(words[i]);
    if (canonical) {
      consumed[i] = true;
      bump(canonical);
    }
  }

  return [...counts.entries()]
    .map(([filler, count]) => ({ filler, count }))
    .sort((a, b) => b.count - a.count || a.filler.localeCompare(b.filler, "fr"));
}

/** Total d'occurrences de béquilles. */
export function totalFillers(counts: FillerCount[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}
