/** Une diapositive extraite du support de présentation. */
export interface Slide {
  /** Numéro de page, à partir de 1. */
  numero: number;
  /** Titre présumé (première ligne significative). */
  titre: string;
  /** Texte complet de la diapositive. */
  texte: string;
  /** Nombre de mots — sert à repérer les diapositives surchargées. */
  motsCount: number;
}

/** Le support de présentation analysé. */
export interface Deck {
  /** Nom du fichier d'origine. */
  nomFichier: string;
  slides: Slide[];
}

/** Un constat sur le support, calculé par du code — jamais par un modèle. */
export interface DeckFinding {
  id: string;
  niveau: "bon" | "attention" | "alerte";
  titre: string;
  detail: string;
  /** Diapositives concernées, s'il y en a. */
  slides?: number[];
}

/** Une question que le jury est susceptible de poser. */
export interface JuryQuestion {
  id: string;
  /** La question elle-même. */
  question: string;
  /** Pourquoi le jury la poserait — ce qui aide à préparer la réponse. */
  pourquoi: string;
  /** Catégorie, pour varier l'entraînement. */
  categorie: "methode" | "technique" | "resultats" | "limites" | "contexte" | "suite";
  /** Diapositive à l'origine de la question, si applicable. */
  slide?: number;
}
