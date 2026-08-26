import { describe, it, expect } from "vitest";
import { derniereRelecture, formaterPourJury, LIMITES_POUR_JURY } from "./pour-jury";
import type { Relecture } from "./relecture";

function stockage(entrees: Record<string, unknown>) {
  const m = new Map(Object.entries(entrees).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
  };
}

const relecture: Relecture = {
  compris: { sujet: "s", problematique: "p", methode: "m", resultats: "r" },
  atouts: [],
  incoherences: [
    { quoi: "Le F1 diffère", presentation: "0,91", rapport: "0,89", gravite: "moyenne" },
    { quoi: "Le nombre de missions", presentation: "sept", rapport: "six", gravite: "haute" },
  ],
  manques: [{ question: "Quel protocole de mesure ?", pourquoi: "" }],
};

describe("les notes du rapporteur pour le jury", () => {
  it("mettent les contradictions de fait en premier", () => {
    const t = formaterPourJury(relecture);
    expect(t.indexOf("nombre de missions")).toBeLessThan(t.indexOf("F1 diffère"));
    expect(t).toContain("Quel protocole de mesure ?");
  });

  it("citent les deux côtés de chaque écart", () => {
    const t = formaterPourJury(relecture);
    expect(t).toContain("la présentation dit « sept »");
    expect(t).toContain("le rapport dit « six »");
  });

  it("restent vides quand il n'y a rien à noter", () => {
    // Pas de section creuse dans le dossier du jury.
    expect(formaterPourJury(null)).toBe("");
    expect(formaterPourJury({ ...relecture, incoherences: [], manques: [] })).toBe("");
  });

  it("se bornent pour ne pas manger le dossier", () => {
    const gros: Relecture = {
      ...relecture,
      incoherences: Array.from({ length: 20 }, (_, i) => ({
        quoi: `écart ${i}`,
        presentation: "a".repeat(300),
        rapport: "b".repeat(300),
        gravite: "moyenne" as const,
      })),
    };
    expect(formaterPourJury(gros).length).toBeLessThanOrEqual(LIMITES_POUR_JURY.chars);
  });
});

describe("retrouver la relecture sur l'appareil", () => {
  it("la lit sous sa clé de cache", () => {
    const st = stockage({ "sc.ia.v1:relecture:abc": { relecture, portee: "x" } });
    expect(derniereRelecture(st)!.incoherences).toHaveLength(2);
  });

  it("prend la plus fournie quand plusieurs coexistent", () => {
    const maigre = { relecture: { ...relecture, incoherences: [], manques: [] }, portee: "" };
    const st = stockage({ "sc.ia.v1:relecture:vieille": maigre, "sc.ia.v1:relecture:actuelle": { relecture, portee: "" } });
    expect(derniereRelecture(st)!.incoherences).toHaveLength(2);
  });

  it("ignore les entrées corrompues et les stockages sans itération", () => {
    const st = stockage({ "sc.ia.v1:relecture:bonne": { relecture, portee: "" } });
    st.setItem("sc.ia.v1:relecture:cassee", "{pas du json");
    expect(derniereRelecture(st)).not.toBeNull();
    expect(derniereRelecture({ getItem: () => null, setItem: () => {} })).toBeNull();
  });
});
