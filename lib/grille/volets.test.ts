import { describe, it, expect } from "vitest";
import { GRILLES, normaliser, mention, criteresDuVolet, RATIO_MIN } from "./index";

/**
 * Un audit a montré que la grille pouvait écrire « Prêt » à un candidat sur
 * trois critères jugés sur douze : le seuil d'abstention était un 6 en dur sur
 * des poids sommés à 18,5, soit 32 % de la grille. Et l'appel, qui ne comporte
 * que des questions, se voyait tout de même soumettre les critères d'exposé —
 * qu'un modèle sommé de tout remplir remplissait.
 *
 * Ces tests figent les deux garde-fous. Ils échoueront si quelqu'un rétablit un
 * seuil absolu, ou laisse un débrief d'appel prononcer « Prêt ».
 */

const notesPour = (ids: readonly number[], note: number) =>
  ({ criteres: ids.map((id) => ({ id, note, constat: "", citation: "", conseil: "" })) });

const QUESTIONS = criteresDuVolet(GRILLES.soutenance, ["questions"]).map((c) => c.id);
const EXPOSE = criteresDuVolet(GRILLES.soutenance, ["expose"]).map((c) => c.id);

describe("les volets d'un oral", () => {
  it("sépare ce qui se juge à l'exposé de ce qui se juge aux réponses", () => {
    expect(EXPOSE).toEqual([1, 3, 9, 11, 12]);
    expect(QUESTIONS).toEqual([2, 4, 5, 6, 7, 8, 10, 13]);
  });

  it("n'expose même pas les critères hors volet à l'évaluation", () => {
    // Ne pas les lister est plus sûr que les lister en espérant un null : le
    // modèle ne peut pas inventer une note pour un critère qu'il n'a pas vu.
    const e = normaliser(notesPour(QUESTIONS, 8), GRILLES.soutenance, ["questions"]);
    for (const id of EXPOSE) expect(e.criteres.map((c) => c.id)).not.toContain(id);
  });

  it("ignore une note que le modèle glisserait sur un critère hors volet", () => {
    const e = normaliser(notesPour([...QUESTIONS, 1, 9], 9), GRILLES.soutenance, ["questions"]);
    expect(e.criteres).toHaveLength(QUESTIONS.length);
  });
});

describe("le seuil d'abstention", () => {
  it("suit le volet évalué, et non une valeur absolue", () => {
    const total = criteresDuVolet(GRILLES.soutenance, ["questions"]).reduce((t, c) => t + c.poids, 0);
    // Un seul critère lourd : bien au-dessus de l'ancien seuil relatif à rien,
    // mais très en dessous de 60 % du volet.
    const maigre = normaliser(notesPour([2, 4], 9), GRILLES.soutenance, ["questions"]);
    expect(maigre.poidsRetenu).toBeLessThan(RATIO_MIN * total);
    expect(maigre.insuffisant).toBe(true);
    expect(maigre.note).toBeNull();
  });

  it("laisse passer une note quand le volet est vraiment couvert", () => {
    const e = normaliser(notesPour(QUESTIONS, 7), GRILLES.soutenance, ["questions"]);
    expect(e.insuffisant).toBe(false);
    expect(e.note).toBe(7);
  });
});

describe("le mot qui accompagne la note", () => {
  it("refuse « Prêt » quand l'exposé n'a pas eu lieu", () => {
    // C'était le défaut le plus coûteux : un candidat qui lit « Prêt » cesse de
    // préparer la moitié de son oral que personne n'a encore vue.
    expect(mention(9.2, ["questions"])).not.toBe("Prêt");
    expect(mention(9.2, ["questions"])).toBe("Solide sur les questions");
  });

  it("l'accorde quand l'oral entier a été vu", () => {
    expect(mention(9.2, ["expose", "questions"])).toBe("Prêt");
  });

  it("s'abstient toujours sans note", () => {
    expect(mention(null, ["expose", "questions"])).toBe("Pas encore mesurable");
  });
});
