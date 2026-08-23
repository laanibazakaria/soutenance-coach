import { describe, it, expect } from "vitest";
import { questionDuJour, marquerJour, calculerSerie, phraseSerie } from "../../lib/quotidien";

const c = (id: string) => ({ id, question: `Q ${id}`, pourquoi: "p", source: "soutenance" as const });

describe("question du jour", () => {
  it("est stable pour une date, quel que soit l'ordre des candidates, et change avec la date", () => {
    const liste = [c("b"), c("a"), c("c"), c("d"), c("e")];
    const j1 = questionDuJour("2026-09-01", liste)!;
    expect(questionDuJour("2026-09-01", [...liste].reverse())!.id).toBe(j1.id);
    const ids = new Set(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map((d) => questionDuJour(d, liste)!.id));
    expect(ids.size).toBeGreaterThan(1);
    expect(questionDuJour("2026-09-01", [])).toBeNull();
  });
});

describe("série", () => {
  it("compte les jours consécutifs, tolère « aujourd'hui pas encore fait », calcule le record", () => {
    let s = null as ReturnType<typeof marquerJour> | null;
    for (const d of ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-06", "2026-09-07"]) s = marquerJour(s, d);
    expect(s!.jours).toHaveLength(5);
    const e = calculerSerie(s, "2026-09-08"); // hier fait, aujourd'hui pas encore
    expect(e).toEqual({ courante: 2, aujourdhuiFait: false, total: 5, record: 3 });
    expect(calculerSerie(s, "2026-09-07").courante).toBe(2);
    expect(calculerSerie(s, "2026-09-07").aujourdhuiFait).toBe(true);
    expect(calculerSerie(s, "2026-09-10").courante).toBe(0);
    expect(calculerSerie(null, "2026-09-10")).toEqual({ courante: 0, aujourdhuiFait: false, total: 0, record: 0 });
    expect(marquerJour(s, "2026-09-07")!.jours).toHaveLength(5); // idempotent
  });

  it("les phrases n'accusent jamais", () => {
    expect(phraseSerie(calculerSerie(null, "2026-09-10"))).toContain("Première");
    const s = marquerJour(marquerJour(null, "2026-09-09"), "2026-09-10");
    expect(phraseSerie(calculerSerie(s, "2026-09-10"))).toContain("2 jours d'affilée");
    expect(phraseSerie(calculerSerie(s, "2026-09-12"))).toContain("record");
  });
});
