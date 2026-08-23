/**
 * L'avis du coach sur une session.
 *
 * Après une répétition, le modèle compare la transcription au support :
 * ce qui a été oublié, ce qui était confus, ce qu'il faut reformuler, ce
 * qui tient. Comme partout dans le projet, il ne note jamais : les chiffres
 * (débit, béquilles, temps) sont calculés par `lib/scoring` et lui sont
 * donnés comme des faits à ne pas contredire.
 */

import type { ScoreReport } from "../scoring/types";
import type { Slide } from "../slides/types";
import type { SlideTiming } from "../types";
import { consigneLangue, type LangueCourte } from "../langue";

export interface DemandeCoach {
  transcript: string;
  durationMs: number;
  targetDurationMs?: number;
  /** Le support, s'il est connu : le coach repère alors ce qui n'a pas été dit. */
  slides?: Pick<Slide, "numero" | "titre" | "texte">[];
  /** Temps par diapositive, si la session était une répétition avec le support. */
  slidesTiming?: SlideTiming[];
  /** Module Entretien : le pitch « présentez-vous » est comparé au CV et à l'offre. */
  candidature?: { poste: string; entreprise: string; offre: string; cvTexte: string };
  /** Modules pitch / concours : la présentation est comparée au dossier. */
  dossier?: { nom: string; persona: string; consigne: string; contexte: string };
  langue?: LangueCourte;
}

export interface Reformulation {
  avant: string;
  apres: string;
}

export interface AvisCoach {
  /** Éléments du support non abordés (vide sans support, ou si tout a été dit). */
  oublis: string[];
  /** Passages peu clairs, cités depuis la transcription. */
  confus: string[];
  /** Phrases à dire autrement : ce qui a été dit → ce qu'il vaut mieux dire. */
  reformulations: Reformulation[];
  /** Ce qui tient la route. */
  points_forts: string[];
  /** LA chose à travailler avant la prochaine répétition. */
  priorite: string;
}

/** Limites de ce qu'on envoie : un support entier, pas un roman. */
export const LIMITES_COACH = { transcriptChars: 7000, slidesChars: 5000 } as const;

function mmss(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

function slidesEnTexte(slides: NonNullable<DemandeCoach["slides"]>): string {
  let budget = LIMITES_COACH.slidesChars;
  const parts: string[] = [];
  for (const s of slides) {
    const bloc = `[Diapositive ${s.numero}] ${s.titre}\n${s.texte.trim()}`;
    if (bloc.length > budget) {
      parts.push(bloc.slice(0, Math.max(0, budget)) + " […]");
      break;
    }
    parts.push(bloc);
    budget -= bloc.length;
  }
  return parts.join("\n\n");
}

/** Construit la consigne. Isolée et testée : c'est ici que vit le garde-fou. */
export function construirePromptCoach(demande: DemandeCoach, rapport: ScoreReport): string {
  const faits = rapport.metrics
    .filter((m) => m.level !== "absent")
    .map((m) => `- ${m.label} : ${m.summary}`)
    .join("\n");

  const temps = demande.targetDurationMs
    ? `Durée parlée : ${mmss(demande.durationMs)} pour ${mmss(demande.targetDurationMs)} visées.`
    : `Durée parlée : ${mmss(demande.durationMs)} (entraînement libre, sans durée visée).`;

  const timing =
    demande.slidesTiming && demande.slidesTiming.length > 0
      ? `\nTEMPS PASSÉ PAR DIAPOSITIVE :\n${demande.slidesTiming.map((t) => `- diapositive ${t.numero} : ${mmss(t.dureeMs)}`).join("\n")}`
      : "";

  const support = demande.slides && demande.slides.length > 0 ? slidesEnTexte(demande.slides) : null;

  if (demande.dossier) {
    const d = demande.dossier;
    return `Tu es un coach qui prépare des candidats à un ${d.nom.toLowerCase()} devant un ${d.persona.toLowerCase()}. Un candidat vient de répéter sa présentation à voix haute. La transcription est automatique : ignore les fautes de transcription, juge le fond et la clarté.

${temps}

STRUCTURE ATTENDUE DE LA PRÉSENTATION :
${d.consigne}

DOSSIER DU CANDIDAT :
${d.contexte.slice(0, 7000)}

TRANSCRIPTION DE LA PRÉSENTATION :
${demande.transcript.slice(0, LIMITES_COACH.transcriptChars)}

MESURES DÉJÀ CALCULÉES (ne les recalcule pas, ne les contredis pas) :
${faits || "- aucune"}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown, de la forme :
{
  "oublis": ["..."],
  "confus": ["..."],
  "reformulations": [{"avant": "...", "apres": "..."}],
  "points_forts": ["..."],
  "priorite": "..."
}

Règles impératives :
- N'attribue AUCUNE note, AUCUN score, AUCUN pourcentage. Tu conseilles, tu ne notes pas.
- "oublis" : 0 à 4 éléments — des blocs de la structure attendue absents, ou des éléments forts du dossier (chiffres, preuves, faits précis) jamais cités. Cite-les précisément. Vide si tout y est.
- "confus" : 0 à 3 passages peu clairs, en citant les mots exacts entre guillemets, puis pourquoi.
- "reformulations" : 1 à 3 — "avant" reprend une phrase réellement dite, "apres" la version que ce jury retient : courte, concrète, un fait.
- "points_forts" : 1 à 3 choses qui tiennent vraiment.
- "priorite" : une seule phrase — la chose à travailler avant le jour J.
- Français, tutoiement, phrases courtes, concret. Exigeant mais bienveillant.${consigneLangue(demande.langue)}`;
  }

  if (demande.candidature) {
    const c = demande.candidature;
    return `Tu es un coach en entretien d'embauche. Un candidat vient de s'entraîner à répondre à « Présentez-vous » (ou à se présenter pour ce poste) à voix haute. La transcription est automatique : ignore les fautes de transcription, juge le fond et la clarté.

${temps}

POSTE VISÉ : ${c.poste || "(non précisé)"} — ENTREPRISE : ${c.entreprise || "(non précisée)"}
OFFRE D'EMPLOI :
${c.offre.trim().slice(0, 3000) || "(non fournie)"}
CV DU CANDIDAT (texte extrait) :
${c.cvTexte.trim().slice(0, 4000) || "(non fourni)"}

TRANSCRIPTION DU PITCH :
${demande.transcript.slice(0, LIMITES_COACH.transcriptChars)}

MESURES DÉJÀ CALCULÉES (ne les recalcule pas, ne les contredis pas) :
${faits || "- aucune"}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown, de la forme :
{
  "oublis": ["..."],
  "confus": ["..."],
  "reformulations": [{"avant": "...", "apres": "..."}],
  "points_forts": ["..."],
  "priorite": "..."
}

Règles impératives :
- N'attribue AUCUNE note, AUCUN score, AUCUN pourcentage. Tu conseilles, tu ne notes pas.
- "oublis" : 0 à 4 éléments — des expériences ou compétences du CV pertinentes pour l'offre et jamais citées, ou des exigences de l'offre jamais adressées. Cite-les précisément. Vide si tout y est.
- "confus" : 0 à 3 passages peu clairs, en citant les mots exacts entre guillemets, puis pourquoi.
- "reformulations" : 1 à 3 — "avant" reprend une phrase réellement dite, "apres" la version qu'un recruteur retient : courte, concrète, orientée résultat.
- "points_forts" : 1 à 3 choses qui tiennent vraiment.
- "priorite" : une seule phrase — la chose à travailler avant l'entretien. Rappelle la structure présent / passé / futur si elle manque, et la durée (deux minutes).
- Français, tutoiement, phrases courtes, concret. Exigeant mais bienveillant.${consigneLangue(demande.langue)}`;
  }

  return `Tu es un coach de soutenance (école d'ingénieurs, Maroc/France). Un étudiant vient de répéter sa présentation à voix haute. La transcription est automatique : ignore les fautes de transcription, juge le fond et la clarté.

${temps}
${timing}

${support ? `SUPPORT DE PRÉSENTATION (texte des diapositives) :\n${support}` : "SUPPORT : inconnu. Tu ne peux donc pas repérer d'oublis — laisse \"oublis\" vide."}

TRANSCRIPTION DE LA RÉPÉTITION :
${demande.transcript.slice(0, LIMITES_COACH.transcriptChars)}

MESURES DÉJÀ CALCULÉES (ne les recalcule pas, ne les contredis pas) :
${faits || "- aucune"}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown, de la forme :
{
  "oublis": ["..."],
  "confus": ["..."],
  "reformulations": [{"avant": "...", "apres": "..."}],
  "points_forts": ["..."],
  "priorite": "..."
}

Règles impératives :
- N'attribue AUCUNE note, AUCUN score, AUCUN pourcentage, AUCUN classement. Tu conseilles, tu ne notes pas.
- "oublis" : 0 à 4 éléments — des contenus présents dans les diapositives et jamais abordés à l'oral. Cite le numéro de diapositive. Vide si tout a été couvert ou si le support est inconnu.
- "confus" : 0 à 3 passages peu clairs, en citant les mots exacts de la transcription entre guillemets, puis pourquoi c'est confus.
- "reformulations" : 1 à 3 — "avant" reprend une phrase réellement dite (citation), "apres" la version à dire, courte et nette.
- "points_forts" : 1 à 3 choses qui tiennent vraiment (pas de compliment vide).
- "priorite" : une seule phrase — la chose à travailler avant la prochaine répétition.
- Français, tutoiement, phrases courtes, concret. Exigeant mais bienveillant.${consigneLangue(demande.langue)}`;
}

function listeDeTextes(v: unknown, max: number): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return null;
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, max);
}

/**
 * Valide la réponse du modèle. On extrait le JSON, on vérifie la forme, et
 * on refuse plutôt que de deviner — un avis mal formé ne vaut pas mieux que
 * pas d'avis.
 */
export function parseAvisCoach(brut: string): AvisCoach | null {
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;

  const oublis = listeDeTextes(o.oublis, 4);
  const confus = listeDeTextes(o.confus, 3);
  const forts = listeDeTextes(o.points_forts, 3);
  if (!oublis || !confus || !forts || forts.length === 0) return null;
  if (typeof o.priorite !== "string" || o.priorite.trim() === "") return null;

  const reformulations: Reformulation[] = [];
  if (o.reformulations !== undefined && o.reformulations !== null) {
    if (!Array.isArray(o.reformulations)) return null;
    for (const r of o.reformulations.slice(0, 3)) {
      if (typeof r !== "object" || r === null) continue;
      const { avant, apres } = r as Record<string, unknown>;
      if (typeof avant === "string" && typeof apres === "string" && avant.trim() && apres.trim()) {
        reformulations.push({ avant: avant.trim(), apres: apres.trim() });
      }
    }
  }

  return { oublis, confus, reformulations, points_forts: forts, priorite: o.priorite.trim() };
}
