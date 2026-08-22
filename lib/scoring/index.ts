/**
 * Le cœur du produit : la grille d'évaluation.
 *
 * Chaque métrique est calculée par du code déterministe — le LLM ne décide
 * jamais d'un chiffre ni d'un verdict (garde-fou n°3 de la fiche de mission).
 * Quand les données ne suffisent pas à un verdict fiable, la métrique est
 * « absente » : pas de détection molle, pas de verdict sur du bruit.
 */

import { tokenize, countFillers, totalFillers } from "./fillers";
import type { MetricResult, ScoreReport, ScoringInput } from "./types";

export type { MetricLevel, MetricResult, ScoreReport, ScoringInput } from "./types";
export { countFillers, tokenize } from "./fillers";

/* ── Seuils documentés ───────────────────────────────────────────────────────
   Débit à l'oral (fr) : la fourchette confortable d'un exposé se situe autour
   de 110–160 mots/min ; en dessous de 90 l'exposé traîne, au-dessus de 185 le
   public décroche. Béquilles : au-delà de 5 pour 100 mots, elles s'entendent
   à chaque phrase. Phrases : au-delà de 30 mots de moyenne, la structure orale
   se perd. Ces seuils sont des constantes exportées pour rester critiquables. */
export const SEUILS = {
  dureeMinimaleMs: 10_000,
  motsMinimumStructure: 60,
  /**
   * En dessous de cette confiance de reconnaissance, la transcription a perdu
   * assez de mots pour fausser tout comptage — le débit s'abstient.
   * Observé en session réelle n°3 : ~92 mots prononcés, 60 transcrits (−35 %),
   * ce qui affichait un « recul » qui n'existait pas.
   */
  confianceMinimaleDebit: 0.8,
  debit: { bonMin: 110, bonMax: 160, attentionMin: 90, attentionMax: 185 },
  bequillesPour100: { bon: 2, attention: 5 },
  phrases: { moyenneHachee: 7, moyenneBonne: 22, moyenneAttention: 30 },
  conclusionFenetre: { ratio: 0.35, motsMinimum: 30 },
} as const;

const INTRO_MARKERS: ReadonlyArray<[label: string, re: RegExp]> = [
  ["annonce de plan", /\b(plan|parties?|points?)\b/iu],
  ["« premièrement »", /\bpremi[èe]rement\b/iu],
  ["« d'abord »", /\bd'?abord\b/iu],
  ["« dans un premier temps »", /dans un premier temps/iu],
  ["« je vais vous présenter »", /je vais (vous )?pr[ée]senter/iu],
  ["« commençons par »", /commen[çc]ons par/iu],
];

const CONCLUSION_MARKERS: ReadonlyArray<[label: string, re: RegExp]> = [
  ["« pour conclure »", /pour conclure/iu],
  ["« en conclusion »", /en conclusion/iu],
  ["« pour terminer »", /pour (terminer|finir)/iu],
  ["« merci de votre attention »", /merci (de votre attention|pour votre attention)/iu],
  ["« je vous remercie »", /je vous remercie/iu],
  // Replis robustes au bruit de transcription — session réelle n°3 : un
  // « Pour conclure » prononcé est arrivé transcrit « Conclure ? », et le
  // marqueur exact le ratait. Dans la fenêtre de conclusion, le mot seul
  // est un signal suffisant.
  ["« conclure/conclusion »", /\bconclu(re|sion|ons)\b/iu],
  ["fin marquée (« c'est fini »)", /\b(c'est|j'ai|j'en ai) fini\b/iu],
];

/** Calcule le rapport complet d'une session. Fonction pure, jamais d'exception. */
export function computeReport(input: ScoringInput): ScoreReport {
  const words = tokenize(input.transcript);
  return {
    wordCount: words.length,
    metrics: [
      debitMetric(words.length, input.durationMs, input.confidence),
      bequillesMetric(input.transcript, words.length),
      phrasesMetric(input.transcript),
      structureMetric(input.transcript, words.length),
    ],
  };
}

function debitMetric(
  wordCount: number,
  durationMs: number,
  confidence: number | undefined,
): MetricResult {
  const base = { id: "debit" as const, label: "Débit de parole" };
  if (durationMs < SEUILS.dureeMinimaleMs || wordCount === 0) {
    return {
      ...base,
      level: "absent",
      summary: "Session trop courte pour mesurer un débit fiable (minimum 10 secondes).",
      details: [],
    };
  }
  // Le débit se calcule sur le nombre de mots *captés*. Si la reconnaissance
  // a peu confiance, elle en a perdu — la mesure dirait « tu parles lentement »
  // alors qu'elle veut dire « je t'ai mal entendu ». On s'abstient.
  if (confidence !== undefined && confidence < SEUILS.confianceMinimaleDebit) {
    return {
      ...base,
      level: "absent",
      summary:
        "La reconnaissance vocale a manqué une partie de tes mots sur cette session — un débit calculé dessus sous-estimerait ton élocution réelle. Micro plus proche ou articulation plus nette pour la prochaine.",
      details: [`Confiance de transcription : ${Math.round(confidence * 100)} %`],
    };
  }
  const wpm = Math.round(wordCount / (durationMs / 60_000));
  const { bonMin, bonMax, attentionMin, attentionMax } = SEUILS.debit;
  const level =
    wpm >= bonMin && wpm <= bonMax
      ? "bon"
      : wpm >= attentionMin && wpm <= attentionMax
        ? "attention"
        : "alerte";
  const summary =
    wpm < bonMin
      ? `${wpm} mots/min : c'est lent pour un exposé — vise 110 à 160. Les silences de réflexion comptent : entraîne-toi à enchaîner.`
      : wpm > bonMax
        ? `${wpm} mots/min : c'est rapide — vise 110 à 160. Respire entre les idées, le jury doit pouvoir suivre.`
        : `${wpm} mots/min : dans la fourchette confortable d'un exposé (110–160).`;
  return { ...base, level, value: wpm, unit: "mots/min", summary, details: [] };
}

function bequillesMetric(transcript: string, wordCount: number): MetricResult {
  const base = { id: "bequilles" as const, label: "Mots béquilles" };
  if (wordCount === 0) {
    return { ...base, level: "absent", summary: "Aucun mot analysable.", details: [] };
  }
  const counts = countFillers(transcript);
  const total = totalFillers(counts);
  const per100 = Math.round((total / wordCount) * 100 * 10) / 10;
  const level =
    per100 <= SEUILS.bequillesPour100.bon
      ? "bon"
      : per100 <= SEUILS.bequillesPour100.attention
        ? "attention"
        : "alerte";
  const top = counts.slice(0, 3).map((c) => `« ${c.filler} » ×${c.count}`);
  return {
    ...base,
    level,
    value: per100,
    unit: "pour 100 mots",
    summary:
      total === 0
        ? "Aucune béquille détectée — rare et remarquable."
        : `${total} béquille${total > 1 ? "s" : ""} (${per100} pour 100 mots)${
            level === "bon" ? " : c'est contenu." : level === "attention" ? " : ça commence à s'entendre." : " : elles parasitent ton discours."
          }`,
    details: top,
  };
}

function phrasesMetric(transcript: string): MetricResult {
  const base = { id: "phrases" as const, label: "Longueur des phrases" };
  const sentences = transcript
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (sentences.length < 2) {
    return {
      ...base,
      level: "absent",
      summary:
        "Ponctuation insuffisante dans la transcription pour découper les phrases — métrique non calculée plutôt que faussée.",
      details: [],
    };
  }
  const lengths = sentences.map((s) => tokenize(s).length).filter((n) => n > 0);
  const mean = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  // Bug découvert en session réelle n°2 : la reconnaissance vocale hache
  // parfois le discours en fragments de 3-4 mots. Personne ne parle ainsi —
  // une moyenne aussi basse trahit le bruit de transcription, pas le style
  // de l'orateur. On s'abstient plutôt que de féliciter à tort.
  if (mean < SEUILS.phrases.moyenneHachee) {
    return {
      ...base,
      level: "absent",
      summary:
        "La transcription a haché ton discours en fragments trop courts pour juger la longueur réelle de tes phrases — métrique non calculée plutôt que faussée.",
      details: [],
    };
  }
  const tooLong = lengths.filter((n) => n > 30).length;
  const level =
    mean <= SEUILS.phrases.moyenneBonne
      ? "bon"
      : mean <= SEUILS.phrases.moyenneAttention
        ? "attention"
        : "alerte";
  return {
    ...base,
    level,
    value: mean,
    unit: "mots/phrase (moyenne)",
    summary:
      level === "bon"
        ? `${mean} mots par phrase en moyenne : des phrases qui respirent.`
        : `${mean} mots par phrase en moyenne : raccourcis — à l'oral, une idée par phrase.`,
    details: tooLong > 0 ? [`${tooLong} phrase${tooLong > 1 ? "s" : ""} de plus de 30 mots`] : [],
  };
}

function structureMetric(transcript: string, wordCount: number): MetricResult {
  const base = { id: "structure" as const, label: "Structure annoncée" };
  if (wordCount < SEUILS.motsMinimumStructure) {
    return {
      ...base,
      level: "absent",
      summary: `Session trop courte pour juger la structure (minimum ${SEUILS.motsMinimumStructure} mots).`,
      details: [],
    };
  }
  const words = tokenize(transcript);
  const introText = words.slice(0, 150).join(" ");
  // Fenêtre de conclusion élargie après la session réelle n°2 : un
  // « pour conclure » suivi de quelques phrases tombait hors des 25 % finaux.
  const fenetre = Math.max(
    SEUILS.conclusionFenetre.motsMinimum,
    Math.ceil(words.length * SEUILS.conclusionFenetre.ratio),
  );
  const conclusionText = words.slice(Math.max(0, words.length - fenetre)).join(" ");

  const introFound = INTRO_MARKERS.filter(([, re]) => re.test(introText)).map(([label]) => label);
  const conclusionFound = CONCLUSION_MARKERS.filter(([, re]) => re.test(conclusionText)).map(
    ([label]) => label,
  );

  const level = introFound.length > 0 && conclusionFound.length > 0 ? "bon" : introFound.length > 0 || conclusionFound.length > 0 ? "attention" : "alerte";
  const details = [
    introFound.length > 0 ? `Intro : ${introFound.join(", ")}` : "Intro : aucune annonce de plan détectée",
    conclusionFound.length > 0 ? `Conclusion : ${conclusionFound.join(", ")}` : "Conclusion : aucun marqueur détecté",
  ];
  return {
    ...base,
    level,
    summary:
      level === "bon"
        ? "Plan annoncé et conclusion marquée : le jury sait toujours où tu en es."
        : level === "attention"
          ? "Une moitié de la structure est marquée — annonce ton plan ET signale ta conclusion."
          : "Ni annonce de plan, ni conclusion marquée : le jury navigue sans carte.",
    details,
  };
}
