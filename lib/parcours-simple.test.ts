import { describe, it, expect } from "vitest";
import { lireParcoursSimple } from "./parcours-simple";

/** Un stockage web complet, comme celui du navigateur. */
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

const deck = { nomFichier: "PFA.pdf", slides: [{ numero: 1, titre: "t", texte: "t", motsCount: 1 }] };
const rapport = { nomFichier: "memoire.pdf", pages: 40, texte: "x".repeat(600), misAJourLe: "2026-08-26T00:00:00Z" };

describe("le fil conducteur", () => {
  it("commence au dépôt quand l'appareil est vide", () => {
    const p = lireParcoursSimple(stockage({}));
    expect(p.courante).toBe(1);
    expect(p.etapes[0]!.etat).toBe("a-faire");
    // Les étapes qui dépendent des documents attendent, sans lien à cliquer.
    expect(p.etapes[1]!.etat).toBe("verrouillee");
    expect(p.etapes[1]!.lien).toBeNull();
    expect(p.etapes[2]!.etat).toBe("verrouillee");
  });

  it("dit précisément quelle pièce manque", () => {
    const p = lireParcoursSimple(stockage({ "sc.deck.v1": deck }));
    expect(p.etapes[0]!.detail).toContain("Il manque ton rapport");
    const q = lireParcoursSimple(stockage({ "sc.ia.v1:rapport:texte": rapport }));
    expect(q.etapes[0]!.detail).toContain("Il manque ta présentation");
  });

  it("déverrouille la relecture et l'appel quand les deux documents sont là", () => {
    const p = lireParcoursSimple(stockage({ "sc.deck.v1": deck, "sc.ia.v1:rapport:texte": rapport }));
    expect(p.etapes[0]!.etat).toBe("faite");
    expect(p.courante).toBe(2);
    expect(p.etapes[1]!.action).toBe("Faire relire mon dossier");
    expect(p.etapes[2]!.action).toBe("Passer mon premier appel");
  });

  it("avance à l'appel une fois la relecture faite", () => {
    const p = lireParcoursSimple(
      stockage({ "sc.deck.v1": deck, "sc.ia.v1:rapport:texte": rapport, "sc.ia.v1:relecture:abc": {} }),
    );
    expect(p.etapes[1]!.etat).toBe("faite");
    expect(p.courante).toBe(3);
  });

  it("compte les appels sans confondre avec la lecture du dossier", () => {
    // « appel-lecture: » partage le début de « appel: » : le fil ne doit
    // compter que les appels réellement passés.
    const p = lireParcoursSimple(
      stockage({
        "sc.deck.v1": deck,
        "sc.ia.v1:rapport:texte": rapport,
        "sc.ia.v1:relecture:abc": {},
        "sc.ia.v1:appel-lecture:soutenance:x": {},
      }),
    );
    expect(p.etapes[2]!.etat).toBe("a-faire");
    expect(p.courante).toBe(3);
  });

  it("ouvre la progression au deuxième appel, pas avant", () => {
    const base = { "sc.deck.v1": deck, "sc.ia.v1:rapport:texte": rapport, "sc.ia.v1:relecture:abc": {} };
    const un = lireParcoursSimple(stockage({ ...base, "sc.ia.v1:appel:a": {} }));
    expect(un.etapes[3]!.etat).toBe("verrouillee");
    const deux = lireParcoursSimple(stockage({ ...base, "sc.ia.v1:appel:a": {}, "sc.ia.v1:appel:b": {} }));
    expect(deux.etapes[3]!.etat).toBe("a-faire");
    expect(deux.courante).toBe(4);
    expect(deux.etapes[2]!.detail).toContain("2 appels déjà passés");
  });

  it("ne plante pas sur un stockage sans itération", () => {
    const minimal = { getItem: () => null, setItem: () => {} };
    expect(lireParcoursSimple(minimal).courante).toBe(1);
  });
});
