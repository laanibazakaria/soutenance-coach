import { describe, it, expect } from "vitest";
import { pronostiquer } from "./pronostic";
import { GRILLES, criteresDuVolet, type Evaluation } from "./index";

const evaluation = (note: number | null, poidsRetenu: number, volets: Evaluation["volets"], insuffisant = false): Evaluation => ({
  oral: "soutenance",
  note,
  poidsRetenu,
  volets,
  criteres: [],
  prioritaires: [],
  acquis: [],
  insuffisant,
});

const POSSIBLE_QUESTIONS = criteresDuVolet(GRILLES.soutenance, ["questions"]).reduce((t, c) => t + c.poids, 0);

describe("le pronostic du jour J", () => {
  it("refuse de pronostiquer sur du vide", () => {
    // Tout le contrat de la plateforme : pas de chiffre sans matière.
    expect(pronostiquer(null)).toBeNull();
    expect(pronostiquer(evaluation(null, 0, ["questions"], true))).toBeNull();
    expect(pronostiquer(evaluation(6, 3, ["questions"], true))).toBeNull();
  });

  it("centre la fourchette sur la note, convertie sur vingt", () => {
    const p = pronostiquer(evaluation(6.5, POSSIBLE_QUESTIONS, ["questions"]))!;
    // 13 au centre, couverture pleine mais sans exposé : ±1,5.
    expect(p.basse).toBe(11.5);
    expect(p.haute).toBe(14.5);
  });

  it("élargit la fourchette quand la grille a moins observé", () => {
    const pleine = pronostiquer(evaluation(6.5, POSSIBLE_QUESTIONS, ["questions"]))!;
    const partielle = pronostiquer(evaluation(6.5, POSSIBLE_QUESTIONS * 0.65, ["questions"]))!;
    expect(partielle.haute - partielle.basse).toBeGreaterThan(pleine.haute - pleine.basse);
  });

  it("dit sa réserve quand l'exposé n'a pas été vu, et la tait sinon", () => {
    expect(pronostiquer(evaluation(6.5, POSSIBLE_QUESTIONS, ["questions"]))!.reserve).toContain("l'exposé n'a pas été évalué");
    const possible = GRILLES.soutenance.criteres.reduce((t, c) => t + c.poids, 0);
    const entier = pronostiquer(evaluation(6.5, possible, ["expose", "questions"]))!;
    expect(entier.reserve).toBe("");
    // Et sa fourchette est plus serrée : ±1.
    expect(entier.haute - entier.basse).toBeCloseTo(2, 5);
  });

  it("ne promet jamais l'impossible", () => {
    const excellent = pronostiquer(evaluation(10, POSSIBLE_QUESTIONS, ["questions"]))!;
    expect(excellent.haute).toBeLessThanOrEqual(19);
    const faible = pronostiquer(evaluation(0.5, POSSIBLE_QUESTIONS, ["questions"]))!;
    expect(faible.basse).toBeGreaterThanOrEqual(4);
  });
});
