import { describe, it, expect } from "vitest";
import { mesuresPourGrille } from "./mesures";

describe("les mesures qui accompagnent la grille", () => {
  const parole = ("euh donc voilà " + "le système détecte les anomalies du trafic réseau avec précision ".repeat(8)).trim();

  it("compte les mots, le débit et les béquilles", () => {
    const m = mesuresPourGrille(parole, 60_000);
    expect(m).toContain("mots par minute");
    expect(m).toContain("Mots béquilles");
    expect(m).toContain("« euh »");
  });

  it("se tait quand la parole est trop courte pour mesurer", () => {
    // Dix mots ne prouvent rien : mieux vaut aucun chiffre qu'un chiffre fragile.
    expect(mesuresPourGrille("bonjour à tous", 60_000)).toBe("");
  });

  it("dit l'absence de béquilles plutôt que de l'omettre", () => {
    const propre = "le système détecte les anomalies du trafic réseau avec précision ".repeat(8);
    expect(mesuresPourGrille(propre, 120_000)).toContain("aucun relevé");
  });
});
