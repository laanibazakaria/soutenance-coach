/**
 * La transcription annotée : les mêmes mots, avec les béquilles marquées
 * là où elles sont dites. Voir « du coup » douze fois en jaune vaut tous
 * les graphiques. Même détection que le comptage (`fillers.ts`) — une
 * seule source de vérité.
 */

import { MULTI_WORD, SINGLE_WORD } from "./fillers";

export interface Segment {
  texte: string;
  type: "normal" | "bequille";
  /** Forme canonique de la béquille, pour l'info-bulle. */
  canonique?: string;
}

function normaliser(brut: string): string {
  return brut.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

/**
 * Découpe en segments en conservant le texte d'origine (espaces, ponctuation,
 * casse). Les expressions multi-mots sont reconnues avant les mots simples,
 * comme dans le comptage.
 */
export function annoterTranscription(transcript: string): Segment[] {
  const morceaux = transcript.split(/(\s+)/);
  // Index des mots (hors espaces) → position dans `morceaux`.
  const mots: { idx: number; norm: string }[] = [];
  morceaux.forEach((m, idx) => {
    if (m !== "" && !/^\s+$/.test(m)) mots.push({ idx, norm: normaliser(m) });
  });
  const marque = new Map<number, string>(); // idx morceau → canonique
  const consomme = new Array<boolean>(mots.length).fill(false);

  for (let i = 0; i < mots.length; i++) {
    if (consomme[i]) continue;
    for (const [canonique, sequence] of MULTI_WORD) {
      if (i + sequence.length > mots.length) continue;
      let ok = true;
      for (let j = 0; j < sequence.length; j++) {
        if (consomme[i + j] || mots[i + j].norm !== sequence[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let j = 0; j < sequence.length; j++) {
          consomme[i + j] = true;
          marque.set(mots[i + j].idx, canonique);
        }
        break;
      }
    }
  }
  for (let i = 0; i < mots.length; i++) {
    if (consomme[i]) continue;
    const canonique = SINGLE_WORD.get(mots[i].norm);
    if (canonique) marque.set(mots[i].idx, canonique);
  }

  // Fusionne les morceaux contigus de même type (les espaces suivent le segment précédent).
  const segments: Segment[] = [];
  morceaux.forEach((m, idx) => {
    if (m === "") return;
    const canonique = marque.get(idx);
    const type: Segment["type"] = canonique ? "bequille" : "normal";
    const dernier = segments[segments.length - 1];
    const espace = /^\s+$/.test(m);
    if (dernier && (espace ? dernier.type === "normal" || segmentSuivantMemeBequille(idx, marque, dernier.canonique) : dernier.type === type && dernier.canonique === canonique)) {
      dernier.texte += m;
    } else if (espace && dernier) {
      // Un espace après une béquille : on ouvre un segment normal.
      segments.push({ texte: m, type: "normal" });
    } else {
      segments.push({ texte: m, type, ...(canonique ? { canonique } : {}) });
    }
  });
  return segments;
}

/** Un espace au milieu d'une expression multi-mots (« du coup ») reste dans le segment béquille. */
function segmentSuivantMemeBequille(idxEspace: number, marque: Map<number, string>, canonique?: string): boolean {
  if (!canonique) return false;
  return marque.get(idxEspace + 1) === canonique && MULTI_WORD.some(([c]) => c === canonique);
}

/** Résumé pour l'en-tête : combien de béquilles, lesquelles. */
export function resumeAnnotation(segments: Segment[]): { total: number; parCanonique: { canonique: string; n: number }[] } {
  const compte = new Map<string, number>();
  for (const s of segments) if (s.type === "bequille" && s.canonique) compte.set(s.canonique, (compte.get(s.canonique) ?? 0) + 1);
  const parCanonique = [...compte.entries()].map(([canonique, n]) => ({ canonique, n })).sort((a, b) => b.n - a.n || a.canonique.localeCompare(b.canonique));
  return { total: parCanonique.reduce((a, b) => a + b.n, 0), parCanonique };
}
