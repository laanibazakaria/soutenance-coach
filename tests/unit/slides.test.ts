import { describe, it, expect } from "vitest";
import { decouperSlide, analyserDeck, repartirTemps, compterMots } from "../../lib/slides/analyse";
import {
  genererQuestions,
  selectionnerPourEntrainement,
  supportExploitable,
} from "../../lib/jury";
import type { Deck } from "../../lib/slides/types";

function deckDe(pages: string[], nom = "presentation.pdf"): Deck {
  return { nomFichier: nom, slides: pages.map((p, i) => decouperSlide(i + 1, p)) };
}

const finding = (deck: Deck, id: string, duree?: number) => {
  const f = analyserDeck(deck, duree).find((x) => x.id === id);
  if (!f) throw new Error(`constat ${id} absent`);
  return f;
};

describe("decouperSlide", () => {
  it("prend la première ligne non vide comme titre", () => {
    const s = decouperSlide(3, "\n\n  Contexte du projet  \nDeuxième ligne\n");
    expect(s.numero).toBe(3);
    expect(s.titre).toBe("Contexte du projet");
    expect(s.texte).toBe("Contexte du projet Deuxième ligne");
  });

  it("page vide → titre de repli, aucun mot", () => {
    const s = decouperSlide(7, "   \n  ");
    expect(s.titre).toBe("Diapositive 7");
    expect(s.motsCount).toBe(0);
  });

  it("un numéro de page ou une puce en tête n'est pas pris pour le titre", () => {
    expect(decouperSlide(2, "iv\nRemerciements\ntexte").titre).toBe("Remerciements");
    expect(decouperSlide(3, "12\n•\nArchitecture du système").titre).toBe("Architecture du système");
    // Rien qui ressemble à du texte : on garde la première ligne plutôt que rien.
    expect(decouperSlide(4, "42\n7").titre).toBe("42");
  });

  it("titre très long → tronqué pour rester lisible", () => {
    const s = decouperSlide(1, "x".repeat(200));
    expect(s.titre.length).toBeLessThanOrEqual(90);
  });
});

describe("compterMots", () => {
  it("compte correctement, robuste aux espaces multiples", () => {
    expect(compterMots("  un   deux\ntrois ")).toBe(3);
    expect(compterMots("   ")).toBe(0);
  });
});

describe("analyserDeck — densité", () => {
  it("diapositives légères → constat positif", () => {
    const deck = deckDe(["Titre\nquelques mots ici", "Contexte\ntrois mots seulement"]);
    expect(finding(deck, "densite").niveau).toBe("bon");
  });

  it("diapositive de plus de 60 mots → signalée avec son numéro", () => {
    const dense = "Titre\n" + Array(80).fill("mot").join(" ");
    const deck = deckDe(["Intro\ncourt", dense]);
    const f = finding(deck, "densite");
    expect(f.niveau).toBe("attention");
    expect(f.slides).toEqual([2]);
  });

  it("l'alerte demande une proportion ET un minimum absolu (3 diapositives)", () => {
    const dense = "Titre\n" + Array(80).fill("mot").join(" ");
    // 2 sur 3 : la proportion est atteinte, pas le minimum → attention.
    expect(finding(deckDe([dense, dense, "court"]), "densite").niveau).toBe("attention");
    // 3 sur 5 : les deux conditions sont réunies → alerte.
    expect(finding(deckDe([dense, dense, dense, "court", "court"]), "densite").niveau).toBe(
      "alerte",
    );
  });
});

describe("analyserDeck — rythme", () => {
  const dix = Array(10).fill("Titre\nun peu de contenu ici");

  it("sans durée visée, le rythme n'est pas évalué", () => {
    expect(analyserDeck(deckDe(dix)).find((f) => f.id === "rythme")).toBeUndefined();
  });

  it("10 diapositives pour 15 min → rythme réaliste", () => {
    expect(finding(deckDe(dix), "rythme", 15).niveau).toBe("bon");
  });

  it("40 diapositives pour 15 min → alerte, avec une fourchette conseillée", () => {
    const f = finding(deckDe(Array(40).fill("Titre\ncontenu")), "rythme", 15);
    expect(f.niveau).toBe("alerte");
    expect(f.detail).toContain("course");
  });

  it("3 diapositives pour 20 min → attention", () => {
    expect(finding(deckDe(Array(3).fill("Titre\ncontenu")), "rythme", 20).niveau).toBe("attention");
  });
});

describe("analyserDeck — plan et conclusion", () => {
  it("détecte une diapositive de plan dans les premières", () => {
    const deck = deckDe(["Titre de la présentation", "Plan\n1. Contexte 2. Méthode 3. Résultats"]);
    expect(finding(deck, "plan").niveau).toBe("bon");
  });

  it("un « plan » qui n'apparaît qu'à la fin ne compte pas", () => {
    const deck = deckDe(["Titre", "A", "B", "C", "D", "Plan détaillé en annexe"]);
    expect(finding(deck, "plan").niveau).toBe("attention");
  });

  it("détecte la conclusion dans les dernières diapositives", () => {
    const deck = deckDe(["Titre", "Contenu", "Conclusion et perspectives"]);
    expect(finding(deck, "conclusion").niveau).toBe("bon");
  });

  it("« Merci de votre attention » compte comme fin marquée", () => {
    const deck = deckDe(["Titre", "Contenu", "Merci de votre attention"]);
    expect(finding(deck, "conclusion").niveau).toBe("bon");
  });

  it("aucune conclusion → attention", () => {
    expect(finding(deckDe(["Titre", "Contenu", "Encore du contenu"]), "conclusion").niveau).toBe(
      "attention",
    );
  });
});

describe("analyserDeck — robustesse", () => {
  it("support vide → aucun constat, jamais d'exception", () => {
    expect(analyserDeck({ nomFichier: "vide.pdf", slides: [] })).toEqual([]);
  });

  it("les constats sortent dans un ordre stable", () => {
    const deck = deckDe(["Plan", "Contenu", "Conclusion"]);
    expect(analyserDeck(deck, 15).map((f) => f.id)).toEqual([
      "densite",
      "rythme",
      "plan",
      "conclusion",
    ]);
  });
});

describe("repartirTemps", () => {
  it("répartit le budget au prorata du contenu, avec un plancher", () => {
    const deck = deckDe(["Titre", "Beaucoup " + Array(50).fill("mot").join(" ")]);
    const repartition = repartirTemps(deck, 10);
    expect(repartition).toHaveLength(2);
    expect(repartition[0].secondes).toBeGreaterThanOrEqual(15);
    expect(repartition[1].secondes).toBeGreaterThan(repartition[0].secondes);
  });
});

describe("jury virtuel — génération de questions", () => {
  const deckIA = deckDe([
    "Titre\nDétection de fraude par intelligence artificielle",
    "Plan\n1. Contexte 2. Méthode 3. Résultats",
    "Données\nCollecte par scraping de 20 000 transactions",
    "Modèle\nRéseau de neurones entraîné sur le dataset",
    "Résultats\nPerformances : 94 % de précision",
    "Conclusion\nMerci de votre attention",
  ]);

  it("un support sur l'IA déclenche les questions sur la fiabilité du modèle", () => {
    const questions = genererQuestions(deckIA);
    expect(questions.some((q) => q.question.includes("fiabilité de votre modèle"))).toBe(true);
  });

  it("un support parlant de données déclenche la question juridique", () => {
    const questions = genererQuestions(deckIA);
    expect(questions.some((q) => q.question.includes("le droit de les utiliser"))).toBe(true);
  });

  it("un thème absent ne génère pas ses questions", () => {
    const deckSansIA = deckDe(["Titre\nÉtude de marché", "Conclusion\nMerci"]);
    const questions = genererQuestions(deckSansIA);
    expect(questions.some((q) => q.question.includes("modèle"))).toBe(false);
  });

  it("les questions universelles sont toujours présentes", () => {
    const questions = genererQuestions(deckDe(["Titre"]));
    expect(questions.some((q) => q.question.includes("recommencer ce projet"))).toBe(true);
    expect(questions.some((q) => q.question.includes("limites de votre travail"))).toBe(true);
  });

  it("une diapositive surchargée génère une question ciblée sur elle", () => {
    const dense = "Architecture\n" + Array(80).fill("mot").join(" ");
    const questions = genererQuestions(deckDe(["Titre", dense]));
    const ciblee = questions.find((q) => q.id.startsWith("dense"));
    expect(ciblee?.slide).toBe(2);
    expect(ciblee?.question).toContain("Architecture");
  });

  it("chaque question explique pourquoi le jury la poserait", () => {
    for (const q of genererQuestions(deckIA)) {
      expect(q.pourquoi.length).toBeGreaterThan(20);
    }
  });

  it("déterminisme : deux générations donnent exactement la même liste", () => {
    expect(genererQuestions(deckIA)).toEqual(genererQuestions(deckIA));
  });

  it("les identifiants sont uniques", () => {
    const ids = genererQuestions(deckIA).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("jury virtuel — sélection pour l'entraînement", () => {
  const questions = genererQuestions(
    deckDe([
      "Titre\nApplication web avec intelligence artificielle",
      "Données\nscraping",
      "Tests\nintégration continue",
      "Résultats\n90 %",
    ]),
  );

  it("varie les catégories avant de se répéter", () => {
    const choisies = selectionnerPourEntrainement(questions, 4);
    expect(choisies).toHaveLength(4);
    expect(new Set(choisies.map((q) => q.categorie)).size).toBe(4);
  });

  it("ne renvoie jamais plus que ce qui existe", () => {
    expect(selectionnerPourEntrainement(questions, 999).length).toBe(questions.length);
  });

  it("sélection déterministe", () => {
    expect(selectionnerPourEntrainement(questions, 5)).toEqual(
      selectionnerPourEntrainement(questions, 5),
    );
  });
});

describe("supportExploitable", () => {
  it("un PDF d'images sans texte est signalé comme inexploitable", () => {
    expect(supportExploitable(deckDe(["", "  ", "x"]))).toBe(false);
  });

  it("un support avec du texte est exploitable", () => {
    expect(supportExploitable(deckDe(["Titre\navec du contenu réel ici"]))).toBe(true);
  });
});
