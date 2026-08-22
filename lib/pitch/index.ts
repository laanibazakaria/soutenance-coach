/**
 * Le pitch : un script de présentation rédigé à partir des diapositives,
 * diapositive par diapositive, calibré sur la durée visée.
 *
 * Le modèle rédige (c'est du qualitatif, son domaine). Le minutage par
 * diapositive, lui, est vérifié ici : si la somme s'écarte de la durée visée,
 * elle est renormalisée — on ne laisse pas un modèle décider d'un chiffre.
 */

import { formaterDeckPourModele } from "../jury/generation";
import type { Deck } from "../slides/types";

export interface PitchSlide {
  numero: number;
  /** L'idée à faire passer, en une phrase. */
  messageCle: string;
  /** Ce qu'il faut dire, tel qu'on le dirait à l'oral. */
  texte: string;
  /** La phrase qui amène la diapositive suivante. */
  transition: string;
  /** Temps conseillé, en secondes. */
  secondes: number;
}

export interface Pitch {
  /** Les premières phrases — celles qui décident de l'attention du jury. */
  accroche: string;
  slides: PitchSlide[];
  /** Les dernières phrases, avant les questions. */
  conclusion: string;
  /** Trois conseils de livraison propres à ce support. */
  conseils: string[];
}

export function construirePromptPitch(deck: Deck, dureeMinutes: number): string {
  const secondesTotal = dureeMinutes * 60;
  return `Tu es un coach de prise de parole qui prépare un étudiant ingénieur à sa soutenance. Voici son support, diapositive par diapositive. Rédige le script complet de ce qu'il doit DIRE, pour une présentation de ${dureeMinutes} minutes (${secondesTotal} secondes au total).

SUPPORT DE PRÉSENTATION :
${formaterDeckPourModele(deck)}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "accroche": "...",
  "slides": [
    { "numero": 1, "messageCle": "...", "texte": "...", "transition": "...", "secondes": 45 }
  ],
  "conclusion": "...",
  "conseils": ["...", "...", "..."]
}

Règles impératives :
- Une entrée par diapositive, dans l'ordre, avec son numéro exact.
- "texte" est ce que l'étudiant dit à voix haute : phrases courtes, langage oral naturel, à la première personne. Il ne lit PAS la diapositive, il la commente — le jury sait lire.
- "messageCle" : l'unique idée que le jury doit retenir de cette diapositive.
- "transition" : la phrase qui enchaîne vers la suivante (vide pour la dernière).
- "secondes" : temps de parole conseillé ; la somme doit faire environ ${secondesTotal}. Donne plus de temps aux diapositives de fond (méthode, résultats) qu'aux titres et transitions.
- "accroche" : les deux premières phrases de la présentation, conçues pour capter l'attention — pas « Bonjour, je vais vous présenter ».
- "conclusion" : les dernières phrases avant d'inviter les questions, qui rappellent l'apport principal.
- "conseils" : trois conseils de livraison SPÉCIFIQUES à ce support (où ralentir, quel chiffre appuyer, quelle diapositive risque de perdre le jury).
- Français, aucune note ni score.`;
}

/**
 * Valide et renormalise le pitch. Les diapositives manquantes ne sont pas
 * inventées ; un minutage qui s'écarte de plus de 15 % de la cible est
 * ramené proportionnellement à la cible.
 */
export function parsePitch(brut: string, nbSlides: number, dureeMinutes: number): Pitch | null {
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.accroche !== "string" || typeof o.conclusion !== "string") return null;
  if (!Array.isArray(o.slides)) return null;

  const slides: PitchSlide[] = [];
  for (const item of o.slides) {
    if (typeof item !== "object" || item === null) continue;
    const s = item as Record<string, unknown>;
    const numero = typeof s.numero === "number" ? Math.round(s.numero) : NaN;
    if (!(numero >= 1 && numero <= nbSlides)) continue;
    if (typeof s.texte !== "string" || s.texte.trim() === "") continue;
    if (slides.some((x) => x.numero === numero)) continue;
    slides.push({
      numero,
      messageCle: typeof s.messageCle === "string" ? s.messageCle.trim() : "",
      texte: s.texte.trim(),
      transition: typeof s.transition === "string" ? s.transition.trim() : "",
      secondes:
        typeof s.secondes === "number" && s.secondes > 0 ? Math.round(s.secondes) : 30,
    });
  }
  if (slides.length === 0) return null;
  slides.sort((a, b) => a.numero - b.numero);

  // Renormalisation du minutage : le modèle propose, le code garantit la cible.
  const cible = dureeMinutes * 60;
  const somme = slides.reduce((n, s) => n + s.secondes, 0);
  if (somme > 0 && Math.abs(somme - cible) / cible > 0.15) {
    const facteur = cible / somme;
    for (const s of slides) s.secondes = Math.max(10, Math.round(s.secondes * facteur));
  }

  const conseils = Array.isArray(o.conseils)
    ? o.conseils.filter((c): c is string => typeof c === "string" && c.trim() !== "").slice(0, 3)
    : [];

  return {
    accroche: o.accroche.trim(),
    slides,
    conclusion: o.conclusion.trim(),
    conseils,
  };
}

/** Rendu texte du pitch, pour copier-coller ou imprimer. */
export function pitchEnTexte(pitch: Pitch, deck: Deck): string {
  const lignes: string[] = [];
  lignes.push("ACCROCHE", pitch.accroche, "");
  for (const s of pitch.slides) {
    const titre = deck.slides.find((d) => d.numero === s.numero)?.titre ?? "";
    lignes.push(`--- Diapositive ${s.numero} — ${titre} (${s.secondes} s) ---`);
    if (s.messageCle) lignes.push(`Message clé : ${s.messageCle}`);
    lignes.push(s.texte);
    if (s.transition) lignes.push(`→ ${s.transition}`);
    lignes.push("");
  }
  lignes.push("CONCLUSION", pitch.conclusion);
  if (pitch.conseils.length > 0) {
    lignes.push("", "CONSEILS DE LIVRAISON");
    pitch.conseils.forEach((c, i) => lignes.push(`${i + 1}. ${c}`));
  }
  return lignes.join("\n");
}
