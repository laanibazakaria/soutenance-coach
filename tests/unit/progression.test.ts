import { describe, expect, it } from "vitest";
import { suivre, resumer, SEUILS_PROGRESSION, type EvaluationDatee } from "../../lib/grille/progression";
import { GRILLES, normaliser, type IdOral } from "../../lib/grille";

/** Une évaluation datée, à partir d'une liste de notes par critère. */
function eval1(date: string, notes: Array<number | null>, oral: IdOral = "soutenance"): EvaluationDatee {
  const criteres = notes.map((note, i) => ({ id: i + 1, note, constat: "c", citation: "", conseil: "x" }));
  return { date, evaluation: normaliser({ criteres }, GRILLES[oral]) };
}

describe("progression — ce qu'on refuse de dire", () => {
  it("ne compare rien avec un seul oral", () => {
    const p = suivre([eval1("2026-08-01", Array(12).fill(6))], "soutenance");
    expect(p.exploitable).toBe(false);
    expect(p.oraux).toBe(1);
    expect(resumer(p)).toContain("Encore un oral");
  });

  it("ignore les oraux d'un autre type", () => {
    const p = suivre([eval1("2026-08-01", Array(12).fill(6)), eval1("2026-08-05", Array(12).fill(9), "entretien")], "soutenance");
    expect(p.oraux).toBe(1);
    expect(p.exploitable).toBe(false);
  });

  it("écarte un critère qui n'a été évalué qu'une fois", () => {
    const a: Array<number | null> = Array(12).fill(null);
    a[0] = 7;
    const b: Array<number | null> = Array(12).fill(null);
    b[1] = 8;
    const p = suivre([eval1("2026-08-01", a), eval1("2026-08-05", b)], "soutenance");
    expect(p.criteres).toHaveLength(0);
    expect(p.exploitable).toBe(false);
  });

  it("ne déclare pas une progression sous un point d'écart", () => {
    const p = suivre([eval1("2026-08-01", Array(12).fill(6)), eval1("2026-08-05", Array(12).fill(6.5))], "soutenance");
    expect(p.criteres.every((c) => c.sens === "stable")).toBe(true);
    expect(p.progresse).toHaveLength(0);
    expect(SEUILS_PROGRESSION.ecartSignificatif).toBe(1);
  });
});

describe("progression — ce qu'on mesure", () => {
  const historique = [
    eval1("2026-08-01", [4, 5, 6, 3, 5, 4, 5, 5, 6, 5, 6, 5]),
    eval1("2026-08-08", [6, 5, 6, 4, 7, 5, 6, 5, 6, 6, 6, 6]),
    eval1("2026-08-15", [8, 5, 7, 3, 9, 6, 7, 5, 6, 7, 6, 7]),
  ];

  it("classe l'histoire dans l'ordre, même si elle arrive mélangée", () => {
    const melange = [historique[2]!, historique[0]!, historique[1]!];
    const p = suivre(melange, "soutenance");
    expect(p.oraux).toBe(3);
    const accroche = p.criteres.find((c) => c.id === 1)!;
    expect(accroche.notes).toEqual([4, 6, 8]);
    expect(accroche.premiere).toBe(4);
    expect(accroche.derniere).toBe(8);
  });

  it("mesure l'écart entre le premier et le dernier oral", () => {
    const p = suivre(historique, "soutenance");
    expect(p.noteDebut).not.toBeNull();
    expect(p.noteFin).not.toBeNull();
    expect(p.ecartNote!).toBeGreaterThan(0);
    expect(p.sens).toBe("monte");
  });

  it("range les progrès du plus fort au moins fort", () => {
    const p = suivre(historique, "soutenance");
    expect(p.progresse[0]!.titre).toBe("Accroche et cadrage"); // 4 → 8
    expect(p.progresse.every((c) => c.ecart >= 1)).toBe(true);
    expect(p.progresse.map((c) => c.ecart)).toEqual([...p.progresse.map((c) => c.ecart)].sort((a, b) => b - a));
  });

  it("nomme ce qui bloque : bas ET immobile", () => {
    const p = suivre(historique, "soutenance");
    const titres = p.bloque.map((c) => c.titre);
    expect(titres).toContain("Méthode justifiée"); // 3 → 3, jamais bougé
    expect(titres).not.toContain("Accroche et cadrage"); // bas au départ, mais monte
    expect(p.bloque.every((c) => c.derniere < 6)).toBe(true);
  });

  it("détecte aussi une baisse", () => {
    const p = suivre([eval1("2026-08-01", Array(12).fill(8)), eval1("2026-08-08", Array(12).fill(5))], "soutenance");
    expect(p.sens).toBe("descend");
    expect(p.criteres.every((c) => c.sens === "descend")).toBe(true);
    expect(resumer(p)).toContain("baisse");
  });

  it("écrit un résumé utile, sans flatterie ni découragement", () => {
    const r = resumer(suivre(historique, "soutenance"));
    expect(r).toContain("Accroche et cadrage");
    expect(r).toContain("Méthode justifiée");
    expect(r).toMatch(/travailler autrement/);
    expect(r).not.toMatch(/bravo|félicitations|nul|catastroph/i);
  });
});

describe("progression — relecture du stockage", () => {
  /** Un faux localStorage, avec l'index par position que la lecture utilise. */
  function faux(entrees: Record<string, string>): Storage {
    const cles = Object.keys(entrees);
    return {
      length: cles.length,
      key: (i: number) => cles[i] ?? null,
      getItem: (k: string) => entrees[k] ?? null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as unknown as Storage;
  }

  it("retrouve les grilles des appels et ignore le reste", async () => {
    const { historiqueDepuisStockage } = await import("../../lib/grille/progression");
    const a = eval1("2026-08-01", Array(12).fill(5));
    const b = eval1("2026-08-08", Array(12).fill(7));
    const st = faux({
      "sc.ia.v1:appel:1": JSON.stringify({ grille: a.evaluation, date: a.date, dialogue: [] }),
      "sc.ia.v1:appel:2": JSON.stringify({ grille: b.evaluation, date: b.date }),
      "sc.ia.v1:appel:3": JSON.stringify({ grille: null, date: "2026-08-09" }),
      "sc.ia.v1:coach:x": JSON.stringify({ diagnostic: "rien à voir" }),
      "sc.sessions.v1": "[]",
      "sc.ia.v1:appel:casse": "{pas du json",
    });
    const h = historiqueDepuisStockage(st);
    expect(h).toHaveLength(2);
    expect(suivre(h, "soutenance").sens).toBe("monte");
  });

  it("rend une liste vide sur un stockage vide", async () => {
    const { historiqueDepuisStockage } = await import("../../lib/grille/progression");
    expect(historiqueDepuisStockage(faux({}))).toEqual([]);
  });
});
