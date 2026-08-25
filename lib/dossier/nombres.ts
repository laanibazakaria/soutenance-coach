/**
 * Comparer les nombres de deux phrases, quelle que soit leur écriture.
 *
 * Un test réel l'a rendu nécessaire : sur sept écarts trouvés entre une
 * présentation et un rapport, un seul était vrai. Parmi les six faux, le motif
 * dominant était la même valeur écrite autrement — « 45 pull requests, 38
 * intégrées » d'un côté, « quarante-cinq pull requests dont trente-huit
 * intégrées » de l'autre. Le modèle y voyait une contradiction chiffrée.
 *
 * On ne se contente donc pas de le lui interdire dans le prompt : on le
 * vérifie. Du code, pas une consigne.
 */

const UNITES: Record<string, number> = {
  zero: 0, zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
  seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100,
  cents: 100, mille: 1000,
};

/** Sans accents ni ponctuation : « quarante-cinq » et « Quarante Cinq » se valent. */
function mots(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Les nombres d'une phrase, chiffres et lettres confondus.
 *
 * Les composés français s'additionnent tant que la suite monte ou reste des
 * unités : « quarante cinq » fait 45, « soixante dix huit » fait 78. Deux
 * nombres du même ordre qui se suivent restent séparés — « trente huit » est un
 * nombre, « cinq trois » en est deux.
 */
export function nombresDe(phrase: string): number[] {
  const trouves: number[] = [];
  const suite = mots(phrase);
  let courant: number | null = null;
  let dernier = 0;

  const clore = () => {
    if (courant !== null) trouves.push(courant);
    courant = null;
    dernier = 0;
  };

  for (const m of suite) {
    if (/^\d+$/.test(m)) {
      clore();
      trouves.push(Number(m));
      continue;
    }
    const v = UNITES[m];
    if (v === undefined) {
      // « et » relie les composés (« vingt et un ») sans les interrompre.
      if (m !== "et") clore();
      continue;
    }
    if (courant === null) {
      courant = v;
      dernier = v;
      continue;
    }
    // « quatre-vingts » : en français, vingt se multiplie après une unité.
    if (v === 20 && courant >= 2 && courant <= 9) {
      courant *= 20;
      dernier = 20;
      continue;
    }
    if (v === 100 || v === 1000) {
      courant *= v;
      dernier = v;
      continue;
    }
    // On complète seulement une dizaine ronde : « dix-huit » et « soixante-dix »
    // se composent, « cinq trois » sont deux nombres distincts.
    if (courant % 10 === 0 && courant >= 10 && v < courant) {
      courant += v;
      dernier = v;
    } else {
      clore();
      courant = v;
      dernier = v;
    }
  }
  clore();
  return trouves;
}

/** Les mêmes nombres, dans le même ordre d'importance — l'écriture importe peu. */
export function memesNombres(a: string, b: string): boolean {
  const na = [...nombresDe(a)].sort((x, y) => x - y);
  const nb = [...nombresDe(b)].sort((x, y) => x - y);
  if (na.length === 0 || na.length !== nb.length) return false;
  return na.every((v, i) => v === nb[i]);
}
