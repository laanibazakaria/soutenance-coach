/**
 * Questions de jury générées par le modèle, à partir du contenu réel des
 * diapositives. Contrairement à la banque de questions déterministe
 * (`index.ts`), celles-ci citent les éléments précis du projet : une
 * technologie nommée, un chiffre avancé, une affirmation à défendre.
 *
 * Ce module est pur (construction du prompt, validation de la réponse) : il
 * se teste sans réseau. L'appel réseau vit dans la route API.
 */

import type { Deck, JuryQuestion } from "../slides/types";

const CATEGORIES: ReadonlyArray<JuryQuestion["categorie"]> = [
  "methode",
  "technique",
  "resultats",
  "limites",
  "contexte",
  "suite",
];

/** Longueur maximale du texte envoyé au modèle (caractères). */
const BUDGET_CARACTERES = 9000;

/**
 * Met le support en forme pour le modèle : une ligne de titre par diapositive,
 * texte tronqué par diapositive puis globalement, pour tenir dans le budget.
 */
export function formaterDeckPourModele(deck: Deck): string {
  const parCaracteres = Math.max(
    200,
    Math.floor(BUDGET_CARACTERES / Math.max(deck.slides.length, 1)),
  );
  const blocs = deck.slides.map((s) => {
    const corps = s.texte.length > parCaracteres ? s.texte.slice(0, parCaracteres) + "…" : s.texte;
    return `[Diapositive ${s.numero}] ${s.titre}\n${corps}`;
  });
  const texte = blocs.join("\n\n");
  return texte.length > BUDGET_CARACTERES ? texte.slice(0, BUDGET_CARACTERES) + "…" : texte;
}

export function construirePromptQuestions(
  deck: Deck,
  options: { nombre?: number; dureeMinutes?: number } = {},
): string {
  const nombre = options.nombre ?? 10;
  return `Tu es un membre de jury de soutenance dans une école d'ingénieurs. Tu as lu le support de présentation d'un étudiant, reproduit ci-dessous diapositive par diapositive. Tu prépares les questions que tu lui poseras après sa présentation${options.dureeMinutes ? ` de ${options.dureeMinutes} minutes` : ""}.

SUPPORT DE PRÉSENTATION :
${formaterDeckPourModele(deck)}

Rédige exactement ${nombre} questions. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, de la forme :
[
  {
    "question": "...",
    "pourquoi": "...",
    "categorie": "methode" | "technique" | "resultats" | "limites" | "contexte" | "suite",
    "slide": 3
  }
]

Règles impératives :
- Chaque question doit être SPÉCIFIQUE à ce projet : elle cite un élément précis du support (une technologie nommée, un chiffre avancé, un choix de conception, une affirmation). Une question qu'on pourrait poser à n'importe quel projet est interdite.
- "slide" est le numéro de la diapositive qui motive la question.
- "pourquoi" explique en une phrase ce que le jury cherche à vérifier en la posant — c'est ce qui aide l'étudiant à préparer sa réponse.
- Varie les catégories : au moins une question de chaque catégorie si le support le permet.
- Inclus au moins deux questions difficiles qui pointent une faiblesse, une contradiction ou un manque réel dans le support.
- Questions en français, vouvoiement, une à deux phrases chacune.
- Aucune note, aucun score, aucun jugement chiffré.`;
}

/**
 * Valide la réponse du modèle. Accepte un tableau nu ou un objet `{questions}`.
 * Les entrées incomplètes sont écartées ; s'il en reste moins de trois, on
 * considère la génération ratée plutôt que d'afficher une liste squelettique.
 */
export function parseQuestionsGenerees(brut: string, nbSlides: number): JuryQuestion[] | null {
  const debut = Math.min(
    ...[brut.indexOf("["), brut.indexOf("{")].filter((i) => i !== -1),
  );
  if (!Number.isFinite(debut)) return null;
  const fin = Math.max(brut.lastIndexOf("]"), brut.lastIndexOf("}"));
  if (fin <= debut) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  const liste = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;
  if (!liste) return null;

  const vues = new Set<string>();
  const questions: JuryQuestion[] = [];
  for (const item of liste) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.question !== "string" || o.question.trim().length < 10) continue;
    if (typeof o.pourquoi !== "string" || o.pourquoi.trim() === "") continue;
    const cle = o.question.trim().toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);

    const categorie = CATEGORIES.includes(o.categorie as JuryQuestion["categorie"])
      ? (o.categorie as JuryQuestion["categorie"])
      : "technique";
    const slideBrut = typeof o.slide === "number" ? Math.round(o.slide) : undefined;
    const slide =
      slideBrut !== undefined && slideBrut >= 1 && slideBrut <= nbSlides ? slideBrut : undefined;

    questions.push({
      id: `ia-${questions.length}`,
      question: o.question.trim(),
      pourquoi: o.pourquoi.trim(),
      categorie,
      slide,
    });
  }
  return questions.length >= 3 ? questions : null;
}
