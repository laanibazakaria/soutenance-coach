import { describe, it, expect } from "vitest";
import { lireSouvenirs, formaterSouvenirs, LIMITES_SOUVENIRS } from "./souvenirs";

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

const critere = (id: number, titre: string, note: number, poids = 2, constat = "constat") => ({
  id, titre, poids, note, constat, citation: "", conseil: "",
});

const appel = (date: string, criteres: unknown[], momentsManques: unknown[] = []) => ({
  mode: "soutenance",
  date,
  grille: { oral: "soutenance", note: 6, poidsRetenu: 10, volets: ["questions"], criteres, prioritaires: [], acquis: [], insuffisant: false },
  debrief: { diagnostic: "", bienFait: [], momentsManques, planAction: [], questionsPosees: [] },
});

describe("la mémoire du jury", () => {
  it("est vide pour un candidat jamais entendu", () => {
    expect(lireSouvenirs(stockage({}), "soutenance")).toBeNull();
    expect(formaterSouvenirs(null)).toBe("");
  });

  it("retient les faiblesses du dernier appel, les plus coûteuses d'abord", () => {
    const s = lireSouvenirs(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-20", [
          critere(2, "Problématique", 8),
          critere(5, "Résultats chiffrés", 3, 2),
          critere(11, "Posture", 4, 1),
        ]),
      }),
      "soutenance",
    )!;
    expect(s.faiblesses.map((f) => f.critere)).toEqual(["Résultats chiffrés", "Posture"]);
    expect(s.faiblesses[0]!.note).toBe(3);
  });

  it("retient les questions ratées avec ce qu'il attendait", () => {
    const s = lireSouvenirs(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-20", [critere(2, "P", 7)], [
          { question: "Sur quel jeu de test ?", ceQueTuAsDit: "euh", mieux: "12 000 sessions tenues à l'écart" },
        ]),
      }),
      "soutenance",
    )!;
    expect(s.questionsRatees[0]!.question).toContain("jeu de test");
    expect(s.questionsRatees[0]!.attendu).toContain("12 000");
  });

  it("voit les progrès entre les deux derniers appels", () => {
    const s = lireSouvenirs(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-18", [critere(5, "Résultats chiffrés", 3)]),
        "sc.ia.v1:appel:b": appel("2026-08-22", [critere(5, "Résultats chiffrés", 7)]),
      }),
      "soutenance",
    )!;
    expect(s.progres).toEqual([{ critere: "Résultats chiffrés", avant: 3, apres: 7 }]);
    expect(s.nbAppels).toBe(2);
  });

  it("ne compte pas un point comme un progrès", () => {
    const s = lireSouvenirs(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-18", [critere(5, "R", 5)]),
        "sc.ia.v1:appel:b": appel("2026-08-22", [critere(5, "R", 6)]),
      }),
      "soutenance",
    )!;
    expect(s.progres).toEqual([]);
  });

  it("sépare les modes : le recruteur ne lit pas la mémoire du jury", () => {
    const st = stockage({ "sc.ia.v1:appel:a": appel("2026-08-20", [critere(5, "R", 3)]) });
    expect(lireSouvenirs(st, "entretien")).toBeNull();
  });

  it("ignore la lecture du dossier et les entrées corrompues", () => {
    const st = stockage({
      "sc.ia.v1:appel-lecture:soutenance:x": { pas: "un appel" },
      "sc.ia.v1:appel:bon": appel("2026-08-20", [critere(5, "R", 3)]),
    });
    st.setItem("sc.ia.v1:appel:casse", "{pas du json");
    expect(lireSouvenirs(st, "soutenance")!.nbAppels).toBe(1);
  });
});

describe("le bloc pour les prompts", () => {
  const s = lireSouvenirs(
    stockage({
      "sc.ia.v1:appel:a": appel("2026-08-18", [critere(5, "Résultats chiffrés", 3)]),
      "sc.ia.v1:appel:b": appel("2026-08-22", [critere(5, "Résultats chiffrés", 7), critere(8, "Maîtrise des chiffres", 4)], [
        { question: "Quel protocole ?", ceQueTuAsDit: "…", mieux: "un A/B reproductible" },
      ]),
    }),
    "soutenance",
  );

  it("porte les trois mémoires : ratées, faiblesses, progrès", () => {
    const t = formaterSouvenirs(s);
    expect(t).toContain("Quel protocole ?");
    expect(t).toContain("Maîtrise des chiffres (4/10)");
    expect(t).toContain("Résultats chiffrés : 3 → 7");
    expect(t.length).toBeLessThanOrEqual(LIMITES_SOUVENIRS.blocChars);
  });

  it("reste vide quand il n'y a rien à retenir", () => {
    const vide = lireSouvenirs(stockage({ "sc.ia.v1:appel:a": appel("2026-08-20", [critere(2, "P", 8)]) }), "soutenance");
    expect(formaterSouvenirs(vide)).toBe("");
  });
});
