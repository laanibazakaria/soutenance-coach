import { describe, it, expect } from "vitest";
import {
  construirePromptRelecture,
  parseRelecture,
  formaterSlides,
  trierIncoherences,
  resumerPortee,
  LIMITES_RELECTURE,
} from "./relecture";
import type { Deck } from "../slides/types";

const deck = (n: number): Deck => ({
  nomFichier: "PFA.pdf",
  slides: Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    titre: `Partie ${i + 1}`,
    texte: `Partie ${i + 1}\nUn F1 de 0,91 sur le jeu de test.`,
    motsCount: 10,
  })),
});

describe("le prompt de relecture", () => {
  it("montre les deux documents dans le même contexte", () => {
    const p = construirePromptRelecture({ deck: deck(3), rapport: "Le F1 mesuré est de 0,89." });
    expect(p).toContain("LA PRÉSENTATION");
    expect(p).toContain("LE RAPPORT");
    expect(p).toContain("0,89");
    expect(p).toContain("[Diapositive 1]");
  });

  it("interdit d'inventer une référence", () => {
    const p = construirePromptRelecture({ deck: deck(2), rapport: "texte" });
    expect(p).toContain("N'invente jamais un numéro de page");
  });

  it("accepte qu'il n'y ait aucune incohérence", () => {
    // Sans cette permission explicite, un modèle sommé de trouver trouve.
    const p = construirePromptRelecture({ deck: deck(2), rapport: "texte" });
    expect(p).toContain("rends une liste vide");
  });

  it("prévient le modèle quand le rapport est tronqué", () => {
    const p = construirePromptRelecture({ deck: deck(2), rapport: "x", rapportTronque: true });
    expect(p).toContain("ne conclus jamais qu'une chose est « absente du rapport »");
  });

  it("ne prétend pas au rapport entier quand il l'a", () => {
    const p = construirePromptRelecture({ deck: deck(2), rapport: "x" });
    expect(p).not.toContain("ne conclus jamais");
  });

  it("borne le rapport sans déborder le contexte", () => {
    const long = "a".repeat(LIMITES_RELECTURE.rapportChars * 2);
    const p = construirePromptRelecture({ deck: deck(2), rapport: long, rapportTronque: true });
    expect(p.length).toBeLessThan(LIMITES_RELECTURE.rapportChars + LIMITES_RELECTURE.slidesChars + 5000);
  });
});

describe("le formatage des diapositives", () => {
  it("numérote chaque diapositive pour qu'on puisse la citer", () => {
    const t = formaterSlides(deck(3));
    expect(t).toContain("[Diapositive 1]");
    expect(t).toContain("[Diapositive 3]");
  });

  it("respecte la borne", () => {
    expect(formaterSlides(deck(500), 1000).length).toBeLessThanOrEqual(1000);
  });
});

describe("l'analyse de la réponse", () => {
  const bon = JSON.stringify({
    compris: { sujet: "Détection d'anomalies", problematique: "Peut-on détecter sans étiquettes ?", methode: "Autoencodeur", resultats: "F1 0,91" },
    incoherences: [
      { quoi: "Le F1 diffère", presentation: "F1 de 0,91", rapport: "F1 mesuré à 0,89", gravite: "haute" },
    ],
    manques: [{ question: "Sur quel jeu de test ?", pourquoi: "Un résultat sans protocole ne se défend pas." }],
  });

  it("lit une réponse complète", () => {
    const r = parseRelecture(bon)!;
    expect(r.compris.sujet).toBe("Détection d'anomalies");
    expect(r.incoherences).toHaveLength(1);
    expect(r.incoherences[0]!.gravite).toBe("haute");
    expect(r.manques[0]!.question).toContain("jeu de test");
  });

  it("survit aux clôtures de code du modèle", () => {
    expect(parseRelecture("```json\n" + bon + "\n```")).not.toBeNull();
  });

  it("écarte une incohérence à qui il manque un côté", () => {
    // Une confrontation sans ses deux citations ne prouve rien : mieux vaut
    // rien afficher qu'une moitié d'accusation.
    const bancal = JSON.stringify({
      compris: { sujet: "S", problematique: "P", methode: "", resultats: "" },
      incoherences: [
        { quoi: "Un écart", presentation: "0,91", rapport: "", gravite: "haute" },
        { quoi: "", presentation: "a", rapport: "b", gravite: "moyenne" },
        { quoi: "Vrai écart", presentation: "a", rapport: "b", gravite: "moyenne" },
      ],
      manques: [],
    });
    const r = parseRelecture(bancal)!;
    expect(r.incoherences).toHaveLength(1);
    expect(r.incoherences[0]!.quoi).toBe("Vrai écart");
  });

  it("accepte l'absence d'incohérence comme un résultat", () => {
    const vide = JSON.stringify({
      compris: { sujet: "S", problematique: "P", methode: "M", resultats: "R" },
      incoherences: [],
      manques: [],
    });
    const r = parseRelecture(vide);
    expect(r).not.toBeNull();
    expect(r!.incoherences).toEqual([]);
  });

  it("refuse une réponse qui n'a rien compris", () => {
    expect(parseRelecture(JSON.stringify({ compris: {}, incoherences: [] }))).toBeNull();
  });

  it("refuse ce qui n'est pas du JSON", () => {
    expect(parseRelecture("Le rapport est bon.")).toBeNull();
  });

  it("ramène une gravité inconnue au moins grave", () => {
    const j = JSON.stringify({
      compris: { sujet: "S", problematique: "P", methode: "", resultats: "" },
      incoherences: [{ quoi: "q", presentation: "a", rapport: "b", gravite: "catastrophique" }],
      manques: [],
    });
    expect(parseRelecture(j)!.incoherences[0]!.gravite).toBe("moyenne");
  });

  it("borne le nombre d'incohérences", () => {
    const trop = Array.from({ length: 30 }, (_, i) => ({ quoi: `q${i}`, presentation: "a", rapport: "b", gravite: "haute" }));
    const j = JSON.stringify({ compris: { sujet: "S", problematique: "P" }, incoherences: trop, manques: [] });
    expect(parseRelecture(j)!.incoherences).toHaveLength(LIMITES_RELECTURE.incoherencesMax);
  });
});

describe("l'ordre d'affichage", () => {
  it("met les contradictions de fait en premier", () => {
    const l = [
      { quoi: "a", presentation: "x", rapport: "y", gravite: "moyenne" as const },
      { quoi: "b", presentation: "x", rapport: "y", gravite: "haute" as const },
    ];
    expect(trierIncoherences(l).map((i) => i.quoi)).toEqual(["b", "a"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const l = [
      { quoi: "a", presentation: "x", rapport: "y", gravite: "moyenne" as const },
      { quoi: "b", presentation: "x", rapport: "y", gravite: "haute" as const },
    ];
    trierIncoherences(l);
    expect(l[0]!.quoi).toBe("a");
  });
});

describe("ce qu'on annonce avoir relu", () => {
  it("dit tout quand tout a été lu", () => {
    expect(resumerPortee(deck(10), 20_000)).toBe("10 diapositives et 10 pages de rapport, confrontées.");
  });

  it("avoue la troncature plutôt que de la taire", () => {
    const s = resumerPortee(deck(10), 120_000);
    expect(s).toContain("premières pages du rapport sur 60");
  });

  it("accorde le singulier", () => {
    expect(resumerPortee({ nomFichier: "x", slides: [{ numero: 1, titre: "t", texte: "t", motsCount: 1 }] }, 2000)).toContain(
      "1 diapositive et 1 page",
    );
  });
});

/**
 * Test réel sur un PFE : sur sept écarts trouvés, un seul était vrai. Le motif
 * dominant des six faux était la même valeur écrite autrement. Le prompt le
 * dit désormais, mais on ne s'en remet pas à son obéissance.
 */
describe("les faux écarts chiffrés", () => {
  const avec = (presentation: string, rapport: string) =>
    parseRelecture(
      JSON.stringify({
        compris: { sujet: "S", problematique: "P", methode: "M", resultats: "R" },
        incoherences: [{ quoi: "Nombre de pull requests", presentation, rapport, gravite: "haute" }],
        manques: [],
      }),
    )!;

  it("écarte une contradiction chiffrée qui n'en est pas une", () => {
    const r = avec(
      "45 pull requests produites — 38 intégrées",
      "quarante-cinq pull requests dont trente-huit intégrées",
    );
    expect(r.incoherences).toHaveLength(0);
  });

  it("garde une vraie contradiction chiffrée", () => {
    const r = avec("Sept missions en six semaines", "six missions successives");
    expect(r.incoherences).toHaveLength(1);
  });

  it("ne touche pas aux écarts sans chiffres", () => {
    const r = avec("Le plan annonce cinq parties", "Le rapport suit un autre découpage");
    expect(r.incoherences).toHaveLength(1);
  });
});

describe("ce que le prompt interdit de signaler", () => {
  it("nomme les faux écarts observés en vrai", () => {
    const p = construirePromptRelecture({ deck: deck(3), rapport: "x".repeat(600) });
    expect(p).toContain("N'EST PAS UNE INCOHÉRENCE");
    expect(p).toContain("une numérotation de section qui diffère");
    expect(p).toContain("si les deux phrases peuvent être vraies ensemble");
  });

  it("préfère le silence au doute", () => {
    const p = construirePromptRelecture({ deck: deck(3), rapport: "x".repeat(600) });
    expect(p).toContain("un écart inventé coûte plus cher au candidat que dix écarts manqués");
  });
});

describe("les points forts", () => {
  it("sont demandés sans flatterie et bornés", () => {
    const p = construirePromptRelecture({ deck: deck(2), rapport: "x".repeat(600) });
    expect(p).toContain("LES POINTS FORTS");
    expect(p).toContain("Pas de flatterie");
  });

  it("sont lus et bornés à l'analyse", () => {
    const r = parseRelecture(
      JSON.stringify({
        compris: { sujet: "S", problematique: "P", methode: "", resultats: "" },
        atouts: Array.from({ length: 12 }, (_, i) => `atout ${i}`),
        incoherences: [],
        manques: [],
      }),
    )!;
    expect(r.atouts).toHaveLength(LIMITES_RELECTURE.atoutsMax);
  });

  it("valent liste vide quand le modèle n'en rend pas", () => {
    // Les anciennes réponses en cache n'ont pas le champ : on ne casse rien.
    const r = parseRelecture(JSON.stringify({ compris: { sujet: "S", problematique: "P" }, incoherences: [], manques: [] }))!;
    expect(r.atouts).toEqual([]);
  });
});
