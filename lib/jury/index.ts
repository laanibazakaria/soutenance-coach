/**
 * Le jury virtuel : génère les questions qu'un jury est susceptible de poser,
 * à partir du contenu réel du support.
 *
 * Deux niveaux, dans l'esprit du projet :
 * 1. **Déterministe** (ce module) — des questions construites à partir de ce
 *    qui est écrit dans les diapositives et de ce qui y manque. Fonctionne
 *    hors ligne, sans modèle, et se teste.
 * 2. **Formulation par un modèle** (plus tard) — reformuler ces questions ou
 *    en générer de plus fines. Le modèle n'invente jamais une lacune : il
 *    part des constats établis ici.
 */

import type { Deck, JuryQuestion } from "../slides/types";

/** Thèmes détectés dans un support, avec les expressions qui les révèlent. */
const THEMES: ReadonlyArray<{
  cle: string;
  motif: RegExp;
  questions: ReadonlyArray<{ q: string; pourquoi: string; cat: JuryQuestion["categorie"] }>;
}> = [
  {
    cle: "ia",
    motif: /\b(intelligence artificielle|\bIA\b|machine learning|apprentissage|mod[èe]le|LLM|r[ée]seau de neurones)\b/iu,
    questions: [
      {
        q: "Comment avez-vous évalué la fiabilité de votre modèle ? Quelles métriques, et sur quel jeu de données ?",
        pourquoi:
          "C'est LA question sur tout projet d'IA. Un jury veut savoir si vous mesurez, ou si vous croyez.",
        cat: "technique",
      },
      {
        q: "Qu'est-ce qui se passe quand votre modèle se trompe ? Comment le détectez-vous ?",
        pourquoi:
          "Les projets étudiants montrent souvent le cas nominal. Le jury cherche la gestion de l'échec.",
        cat: "limites",
      },
      {
        q: "Pourquoi ce modèle plutôt qu'une approche plus simple ? Avez-vous comparé ?",
        pourquoi: "Un jury se méfie de la solution complexe choisie par défaut.",
        cat: "methode",
      },
    ],
  },
  {
    cle: "donnees",
    motif: /\b(donn[ée]es|dataset|base de donn[ée]es|scraping|collecte|corpus)\b/iu,
    questions: [
      {
        q: "D'où viennent vos données, et avez-vous le droit de les utiliser ainsi ?",
        pourquoi: "Question juridique et éthique fréquente, souvent mal préparée.",
        cat: "contexte",
      },
      {
        q: "Comment avez-vous nettoyé vos données ? Quelle proportion avez-vous dû écarter ?",
        pourquoi: "Le nettoyage révèle la rigueur — et les chiffres écartés intéressent le jury.",
        cat: "methode",
      },
    ],
  },
  {
    cle: "web",
    motif: /\b(application|plateforme|site|web|API|front|back|interface)\b/iu,
    questions: [
      {
        q: "Votre application tiendrait-elle avec mille utilisateurs simultanés ? Qu'est-ce qui casserait en premier ?",
        pourquoi: "Le jury teste si vous avez pensé au-delà de la démo.",
        cat: "technique",
      },
      {
        q: "Comment garantissez-vous que les données des utilisateurs sont protégées ?",
        pourquoi: "Sécurité et RGPD : attendus dès qu'il y a des utilisateurs.",
        cat: "technique",
      },
    ],
  },
  {
    cle: "tests",
    motif: /\b(tests?|qualit[ée]|CI|int[ée]gration continue|d[ée]ploiement)\b/iu,
    questions: [
      {
        q: "Qu'est-ce que vos tests ne couvrent pas ? Quel bug pourrait encore passer ?",
        pourquoi:
          "Répondre « tout est testé » est un piège. Le jury valorise la lucidité sur les angles morts.",
        cat: "limites",
      },
    ],
  },
  {
    cle: "resultats",
    motif: /\b(r[ée]sultats?|performances?|[ée]valuation|comparaison|benchmark|%)\b/iu,
    questions: [
      {
        q: "Ce résultat est-il significatif, ou pourrait-il être dû au hasard de votre échantillon ?",
        pourquoi: "Le jury cherche à savoir si vous prenez vos chiffres au sérieux.",
        cat: "resultats",
      },
      {
        q: "Comment vous situez-vous par rapport à l'existant ? Qu'apportez-vous de plus ?",
        pourquoi: "Question de positionnement, systématique en PFE.",
        cat: "contexte",
      },
    ],
  },
];

/** Questions posées à presque toutes les soutenances, quel que soit le sujet. */
const QUESTIONS_UNIVERSELLES: ReadonlyArray<{
  q: string;
  pourquoi: string;
  cat: JuryQuestion["categorie"];
}> = [
  {
    q: "Si vous deviez recommencer ce projet, que feriez-vous différemment ?",
    pourquoi:
      "Question quasi systématique. Elle teste le recul. Prépare une vraie réponse, pas « rien, tout allait bien ».",
    cat: "limites",
  },
  {
    q: "Quelle a été la plus grosse difficulté, et comment l'avez-vous surmontée ?",
    pourquoi:
      "Le jury veut une difficulté technique précise, pas « la gestion du temps ». Choisis-en une et raconte-la.",
    cat: "methode",
  },
  {
    q: "Quelles sont les limites de votre travail ?",
    pourquoi:
      "Les annoncer soi-même vaut mieux que de les subir. Prépare-en deux ou trois, franches.",
    cat: "limites",
  },
  {
    q: "Comment ce travail pourrait-il être poursuivi ?",
    pourquoi: "Clôture classique. Une réponse concrète montre que tu maîtrises ton sujet.",
    cat: "suite",
  },
  {
    q: "Qu'avez-vous appris personnellement sur ce projet ?",
    pourquoi: "Question humaine — souvent la dernière. Elle mérite mieux qu'une improvisation.",
    cat: "contexte",
  },
];

/** Identifiant stable, déterministe (pas de hasard : la liste doit être reproductible). */
function idDe(prefixe: string, index: number): string {
  return `${prefixe}-${index}`;
}

/**
 * Construit la liste de questions probables pour un support donné.
 * Déterministe : le même support produit toujours la même liste.
 */
export function genererQuestions(deck: Deck): JuryQuestion[] {
  const texteComplet = deck.slides.map((s) => s.texte).join(" ");
  const questions: JuryQuestion[] = [];

  // 1. Questions liées aux thèmes réellement présents dans le support.
  for (const theme of THEMES) {
    if (!theme.motif.test(texteComplet)) continue;
    const slide = deck.slides.find((s) => theme.motif.test(s.texte));
    theme.questions.forEach((q, i) => {
      questions.push({
        id: idDe(theme.cle, i),
        question: q.q,
        pourquoi: q.pourquoi,
        categorie: q.cat,
        slide: slide?.numero,
      });
    });
  }

  // 2. Questions issues des diapositives surchargées : ce qui est écrit en
  //    petit finit souvent en question.
  const chargees = deck.slides.filter((s) => s.motsCount > 60).slice(0, 2);
  chargees.forEach((s, i) => {
    questions.push({
      id: idDe("dense", i),
      question: `Sur la diapositive ${s.numero} (« ${s.titre} »), pouvez-vous résumer l'essentiel en une phrase ?`,
      pourquoi:
        "Une diapositive dense attire l'œil du jury : il y cherchera un détail à vous faire expliquer.",
      categorie: "technique",
      slide: s.numero,
    });
  });

  // 3. Les universelles, toujours en dernier.
  QUESTIONS_UNIVERSELLES.forEach((q, i) => {
    questions.push({
      id: idDe("universel", i),
      question: q.q,
      pourquoi: q.pourquoi,
      categorie: q.cat,
    });
  });

  return questions;
}

/** Regroupe les questions par catégorie, dans un ordre d'affichage stable. */
export const ORDRE_CATEGORIES: ReadonlyArray<JuryQuestion["categorie"]> = [
  "methode",
  "technique",
  "resultats",
  "limites",
  "contexte",
  "suite",
];

export const LIBELLES_CATEGORIES: Record<JuryQuestion["categorie"], string> = {
  methode: "Méthode",
  technique: "Technique",
  resultats: "Résultats",
  limites: "Limites",
  contexte: "Contexte",
  suite: "Perspectives",
};

/** Sélectionne `n` questions variées (une par catégorie d'abord), sans hasard. */
export function selectionnerPourEntrainement(questions: JuryQuestion[], n: number): JuryQuestion[] {
  const parCategorie = new Map<string, JuryQuestion[]>();
  for (const q of questions) {
    const liste = parCategorie.get(q.categorie) ?? [];
    liste.push(q);
    parCategorie.set(q.categorie, liste);
  }
  const choisies: JuryQuestion[] = [];
  let tour = 0;
  while (choisies.length < n) {
    let ajoutADuTour = false;
    for (const categorie of ORDRE_CATEGORIES) {
      const liste = parCategorie.get(categorie);
      if (liste && liste[tour]) {
        choisies.push(liste[tour]);
        ajoutADuTour = true;
        if (choisies.length === n) break;
      }
    }
    if (!ajoutADuTour) break;
    tour++;
  }
  return choisies;
}

/** Le support ne contient rien d'exploitable ? On le dit plutôt que d'inventer. */
export function supportExploitable(deck: Deck): boolean {
  return deck.slides.some((s) => s.motsCount >= 5);
}
