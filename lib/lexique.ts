/**
 * Le lexique du dossier : les mots que Whisper va écorcher si on ne le
 * prévient pas — sigles (ENSIAS, RAG, PFE), noms propres (Propulsez,
 * Vercel), termes techniques (idempotence). Whisper accepte un « prompt »
 * de contexte qui oriente sa transcription : lui souffler ce vocabulaire
 * améliore la reconnaissance des termes du métier sans un seul appel IA
 * de plus. Extraction déterministe, comme tout ce qui peut l'être.
 */

/** Mots français courants qui portent une majuscule en début de phrase. */
const COMMUNS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux", "ce", "cet", "cette", "ces",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "mon", "ma", "mes", "son", "sa", "ses",
  "et", "ou", "mais", "donc", "car", "ni", "or", "si", "que", "qui", "quoi", "dont", "quand", "comme",
  "pour", "par", "avec", "sans", "sous", "sur", "dans", "entre", "vers", "chez", "avant", "apres", "pendant",
  "est", "sont", "etre", "avoir", "fait", "faire", "peut", "doit", "ainsi", "alors", "aussi", "enfin",
  "chapitre", "figure", "tableau", "annexe", "page", "partie", "section", "introduction", "conclusion",
  "resume", "sommaire", "remerciements", "bibliographie", "contexte", "objectif", "objectifs", "mission", "missions",
]);

function normalise(mot: string): string {
  return mot.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Les termes distinctifs d'un texte, par fréquence décroissante :
 * - les sigles (2 à 8 capitales, chiffres admis : RAG, PFE, GPT-4) ;
 * - les mots à majuscule vus plusieurs fois et rarement en minuscules
 *   (noms propres — pas les débuts de phrase) ;
 * - les mots à chiffre ou point interne (Node.js, S3).
 */
export function extraireLexique(texte: string, max = 40): string[] {
  // Pas d'apostrophe dans le jeton : « l'ENSIAS » doit se couper en « l » + « ENSIAS ».
  const mots = texte.match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9.-]{1,29}/g) ?? [];
  const majuscules = new Map<string, { forme: string; n: number }>();
  const minuscules = new Map<string, number>();
  const sigles = new Map<string, number>();
  const techniques = new Map<string, number>();

  for (const brut of mots) {
    const mot = brut.replace(/^['.-]+|['.-]+$/g, "");
    if (mot.length < 2) continue;
    const cle = normalise(mot);
    if (/^[A-Z0-9][A-Z0-9-]{1,7}$/.test(mot) && /[A-Z]{2}/.test(mot)) {
      sigles.set(mot, (sigles.get(mot) ?? 0) + 1);
    } else if (/^[A-ZÀ-Ý]/.test(mot)) {
      const e = majuscules.get(cle);
      majuscules.set(cle, { forme: e?.forme ?? mot, n: (e?.n ?? 0) + 1 });
    } else {
      minuscules.set(cle, (minuscules.get(cle) ?? 0) + 1);
      if (/[0-9]/.test(mot) || /\w\.\w/.test(mot)) techniques.set(mot, (techniques.get(mot) ?? 0) + 1);
    }
  }

  const retenus: { terme: string; n: number }[] = [];
  for (const [terme, n] of sigles) if (n >= 2 && !COMMUNS.has(normalise(terme))) retenus.push({ terme, n });
  for (const [cle, { forme, n }] of majuscules) {
    if (n < 2 || COMMUNS.has(cle) || forme.length < 3) continue;
    // Vu plus souvent en minuscules qu'en majuscules : simple début de phrase.
    if ((minuscules.get(cle) ?? 0) > n) continue;
    retenus.push({ terme: forme, n });
  }
  for (const [terme, n] of techniques) if (n >= 2) retenus.push({ terme, n });

  return retenus
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((r) => r.terme);
}

/** Le lexique formaté pour le prompt Whisper — borné, une seule ligne. */
export function formaterLexique(termes: string[]): string {
  if (termes.length === 0) return "";
  return termes.join(", ").slice(0, 450);
}
