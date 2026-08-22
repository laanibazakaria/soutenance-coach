/**
 * Analyse d'un support de présentation — fonctions pures, testables sans
 * navigateur. L'extraction du PDF (qui, elle, dépend du navigateur) vit
 * séparément dans `extract.ts`.
 *
 * Même discipline que le reste du projet : chaque constat est calculé, et
 * quand la donnée manque, on ne conclut pas.
 */

import type { Deck, DeckFinding, Slide } from "./types";

export const SEUILS_DECK = {
  /** Au-delà, la diapositive est trop chargée pour être lue par le jury. */
  motsParSlide: 60,
  /** En dessous, la diapositive est probablement une transition (pas un défaut). */
  motsMinimumSlide: 5,
  /** Nombre minimum de diapositives chargées avant de passer en alerte. */
  chargeesPourAlerte: 3,
  /** Durée de parole moyenne raisonnable par diapositive, en secondes. */
  secondesParSlide: { min: 30, max: 90 },
} as const;

/** Compte les mots d'un texte. */
export function compterMots(texte: string): number {
  const t = texte.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/**
 * Découpe le texte brut d'une page en titre + corps.
 * Le titre est la première ligne non vide, tronquée à une longueur lisible.
 */
export function decouperSlide(numero: number, texteBrut: string): Slide {
  const lignes = texteBrut
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  // Le titre est la première ligne qui ressemble à du texte : on saute les
  // numéros de page (« 12 », « iv »), les puces seules et les dates isolées,
  // fréquents en tête de diapositive exportée.
  const titreCandidat = lignes.find((l) => /\p{L}{3,}/u.test(l) && !/^[ivxlc]+$/iu.test(l));
  const titre = (titreCandidat ?? lignes[0] ?? `Diapositive ${numero}`).slice(0, 90);
  const texte = lignes.join(" ");
  return { numero, titre, texte, motsCount: compterMots(texte) };
}

/**
 * Constats sur le support : densité, longueur, présence d'un plan et d'une
 * conclusion. Rendus dans un ordre stable.
 */
export function analyserDeck(deck: Deck, dureeVisecMinutes?: number): DeckFinding[] {
  const findings: DeckFinding[] = [];
  const slides = deck.slides;
  if (slides.length === 0) return findings;

  // 1. Diapositives surchargées
  const chargees = slides.filter((s) => s.motsCount > SEUILS_DECK.motsParSlide);
  findings.push(
    chargees.length === 0
      ? {
          id: "densite",
          niveau: "bon",
          titre: "Diapositives lisibles",
          detail: `Aucune diapositive ne dépasse ${SEUILS_DECK.motsParSlide} mots : le jury peut t'écouter au lieu de lire.`,
        }
      : {
          id: "densite",
          // L'alerte demande une proportion ET un minimum absolu : sur un
          // support de deux diapositives, une seule chargée fait déjà 50 % —
          // un ratio seul crierait à l'alerte sur un échantillon minuscule.
          niveau:
            chargees.length >= SEUILS_DECK.chargeesPourAlerte &&
            chargees.length > slides.length / 3
              ? "alerte"
              : "attention",
          titre: `${chargees.length} diapositive${chargees.length > 1 ? "s" : ""} surchargée${chargees.length > 1 ? "s" : ""}`,
          detail:
            "Au-delà de 60 mots, le jury lit au lieu d'écouter — et il lit plus vite que tu ne parles. Allège, ou déplace le détail en annexe.",
          slides: chargees.map((s) => s.numero),
        },
  );

  // 2. Rythme : nombre de diapositives vs durée visée
  if (dureeVisecMinutes && dureeVisecMinutes > 0) {
    const secondesParSlide = (dureeVisecMinutes * 60) / slides.length;
    const { min, max } = SEUILS_DECK.secondesParSlide;
    const arrondi = Math.round(secondesParSlide);
    findings.push(
      secondesParSlide >= min && secondesParSlide <= max
        ? {
            id: "rythme",
            niveau: "bon",
            titre: `Rythme réaliste : ${arrondi} s par diapositive`,
            detail: `${slides.length} diapositives pour ${dureeVisecMinutes} minutes — c'est tenable.`,
          }
        : {
            id: "rythme",
            niveau: secondesParSlide < min ? "alerte" : "attention",
            titre:
              secondesParSlide < min
                ? `Trop de diapositives : ${arrondi} s chacune`
                : `Peu de diapositives : ${arrondi} s chacune`,
            detail:
              secondesParSlide < min
                ? `${slides.length} diapositives en ${dureeVisecMinutes} minutes, c'est une course. Vise 30 à 90 secondes par diapositive — soit ${Math.floor((dureeVisecMinutes * 60) / max)} à ${Math.floor((dureeVisecMinutes * 60) / min)} diapositives.`
                : `Avec si peu de diapositives, tu risques de t'étaler ou de meubler. Vise 30 à 90 secondes par diapositive.`,
          },
    );
  }

  // 3. Plan annoncé
  const aPlan = slides
    .slice(0, Math.min(4, slides.length))
    .some((s) => /\b(plan|sommaire|agenda|parties?|d[ée]roul[ée])\b/iu.test(s.texte));
  findings.push({
    id: "plan",
    niveau: aPlan ? "bon" : "attention",
    titre: aPlan ? "Plan annoncé au début" : "Aucune diapositive de plan détectée",
    detail: aPlan
      ? "Le jury sait dès le départ où tu l'emmènes."
      : "Une diapositive de plan dans les premières aide le jury à te suivre — et t'aide à ne pas perdre le fil.",
  });

  // 4. Conclusion
  const derniers = slides.slice(-3);
  const aConclusion = derniers.some((s) =>
    /\b(conclusion|conclure|perspectives?|merci|questions?)\b/iu.test(s.texte),
  );
  findings.push({
    id: "conclusion",
    niveau: aConclusion ? "bon" : "attention",
    titre: aConclusion ? "Conclusion présente" : "Aucune diapositive de conclusion détectée",
    detail: aConclusion
      ? "La fin est marquée : le jury sait quand passer aux questions."
      : "Termine par une diapositive de conclusion ou de perspectives — sinon la présentation s'arrête au lieu de finir.",
  });

  return findings;
}

/**
 * Propose un plan de passage : combien de temps consacrer à chaque diapositive.
 * Purement indicatif, calculé au prorata du contenu.
 */
export function repartirTemps(
  deck: Deck,
  dureeMinutes: number,
): Array<{ slide: Slide; secondes: number }> {
  const total = deck.slides.reduce((n, s) => n + Math.max(s.motsCount, 1), 0);
  const budget = dureeMinutes * 60;
  return deck.slides.map((slide) => ({
    slide,
    secondes: Math.max(15, Math.round((Math.max(slide.motsCount, 1) / total) * budget)),
  }));
}
