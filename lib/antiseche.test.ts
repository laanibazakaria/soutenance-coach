import { describe, it, expect } from "vitest";
import { construireAntiseche, LIMITES_ANTISECHE } from "./antiseche";

/** Un stockage web complet, avec l'itération que StorageLike n'expose pas. */
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

const deck = {
  nomFichier: "PFA.pdf",
  slides: [
    { numero: 1, titre: "Contexte", texte: "t", motsCount: 1 },
    { numero: 2, titre: "Méthode", texte: "t", motsCount: 1 },
    { numero: 3, titre: "Résultats", texte: "t", motsCount: 1 },
  ],
};

const fiche = {
  sujet: "s",
  compris: [],
  chiffres: ["F1 : 0,91 sur le jeu de test", "240 000 sessions d'entraînement"],
  fragilites: ["Le protocole de mesure n'est pas décrit"],
  angles: [],
};

describe("l'antisèche du jour J", () => {
  it("rassemble les quatre sections depuis les caches existants", () => {
    const a = construireAntiseche(
      stockage({
        "sc.deck.v1": deck,
        "sc.ia.v1:appel-lecture:soutenance:abc": fiche,
        "sc.ia.v1:pitch:xyz": { accroche: "Trois mots pour commencer.", slides: [], conclusion: "", conseils: [] },
      }),
    )!;
    expect(a.accroche).toBe("Trois mots pour commencer.");
    expect(a.plan).toEqual(["Contexte", "Méthode", "Résultats"]);
    expect(a.chiffres).toHaveLength(2);
    expect(a.fragilites).toEqual(["Le protocole de mesure n'est pas décrit"]);
  });

  it("tient debout avec une seule section", () => {
    const a = construireAntiseche(stockage({ "sc.deck.v1": deck }))!;
    expect(a.plan).toHaveLength(3);
    expect(a.accroche).toBeNull();
    expect(a.chiffres).toEqual([]);
  });

  it("rend null quand il n'y a rien à emporter", () => {
    expect(construireAntiseche(stockage({}))).toBeNull();
  });

  it("préfère la fiche la plus fournie quand plusieurs coexistent", () => {
    const maigre = { ...fiche, chiffres: ["un seul"], fragilites: [] };
    const a = construireAntiseche(
      stockage({
        "sc.ia.v1:appel-lecture:soutenance:vieux": maigre,
        "sc.ia.v1:appel-lecture:soutenance:actuel": fiche,
      }),
    )!;
    expect(a.chiffres).toHaveLength(2);
  });

  it("survit à une entrée corrompue sans perdre les autres", () => {
    const st = stockage({ "sc.ia.v1:appel-lecture:soutenance:bon": fiche });
    st.setItem("sc.ia.v1:appel-lecture:soutenance:casse", "{pas du json");
    expect(construireAntiseche(st)!.chiffres).toHaveLength(2);
  });

  it("borne chaque section", () => {
    const gros = {
      ...fiche,
      chiffres: Array.from({ length: 20 }, (_, i) => `chiffre ${i}`),
      fragilites: Array.from({ length: 20 }, (_, i) => `fragilité ${i}`),
    };
    const a = construireAntiseche(stockage({ "sc.ia.v1:appel-lecture:soutenance:x": gros }))!;
    expect(a.chiffres).toHaveLength(LIMITES_ANTISECHE.chiffres);
    expect(a.fragilites).toHaveLength(LIMITES_ANTISECHE.fragilites);
  });

  it("ne plante pas sur un stockage sans itération", () => {
    // Le StorageLike minimal des autres modules : pas de length ni de key.
    const minimal = { getItem: () => null, setItem: () => {} };
    expect(construireAntiseche(minimal)).toBeNull();
  });
});
