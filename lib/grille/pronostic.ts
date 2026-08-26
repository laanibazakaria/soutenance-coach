/**
 * Le pronostic : la question que l'étudiant se pose vraiment à 23h.
 *
 * Pas « quelle est ma moyenne pondérée sur dix » — mais « si ma soutenance
 * était demain, j'aurais combien ? ». On y répond avec une fourchette sur
 * vingt, calculée depuis la grille par du code, jamais par le modèle, et dont
 * la largeur dit honnêtement ce qu'on ignore : moins la grille a pu observer,
 * plus la fourchette est large. Un appel ne voit que les questions — son
 * pronostic le dit.
 */

import { GRILLES, criteresDuVolet, type Evaluation } from "./index";

export interface Pronostic {
  /** Les deux bornes, sur vingt, au demi-point. */
  basse: number;
  haute: number;
  /** Ce que le pronostic n'a pas vu — vide quand l'oral entier a été évalué. */
  reserve: string;
}

const demi = (n: number) => Math.round(n * 2) / 2;
const borner = (n: number) => Math.min(19, Math.max(4, n));

/**
 * La fourchette, ou null quand la grille s'est abstenue — on ne pronostique
 * pas sur du vide, c'est tout le contrat de la plateforme.
 */
export function pronostiquer(e: Evaluation | null | undefined): Pronostic | null {
  if (!e || e.insuffisant || e.note === null) return null;

  const centre = e.note * 2;

  // La marge suit la couverture : ce que la grille a pesé sur ce qu'elle
  // aurait pu peser dans ses volets.
  const possible = criteresDuVolet(GRILLES[e.oral], e.volets).reduce((t, c) => t + c.poids, 0);
  const couverture = possible > 0 ? e.poidsRetenu / possible : 0;
  let marge = couverture >= 0.85 ? 1 : 1.5;

  // Un appel ne juge que les questions : l'exposé reste une inconnue entière.
  const sansExpose = !e.volets.includes("expose");
  if (sansExpose) marge += 0.5;

  return {
    basse: borner(demi(centre - marge)),
    haute: borner(demi(centre + marge)),
    reserve: sansExpose
      ? "Estimé sur tes réponses aux questions seulement — l'exposé n'a pas été évalué. La soutenance blanche le couvre."
      : "",
  };
}
