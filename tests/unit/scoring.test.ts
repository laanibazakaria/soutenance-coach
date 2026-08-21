import { describe, it, expect } from "vitest";
import { computeReport, countFillers, tokenize, SEUILS } from "../../lib/scoring";

/** Transcription de la toute première session réelle du projet (77 mots, 1 min 13). */
const SESSION_REELLE = `Ouais, je vais vous présenter mon stage chez propolis. Donc j'ai travaillé sur une application de coaching commercial basée sur l'intelligence artificielle. En effet, l'objectif principal, c'était de. D'analyser les appels des commerciaux. Du coup, de leur donner un feedback automatique. Donc j'ai développé plusieurs missions. Notamment la mission 7. Qui est concerné ? L'analyse, longitude. En effet, cette mission, c'était vraiment intéressante parce que. Et ça permettait. De suivre la progression dans le temps, et voilà.`;

function metric(report: ReturnType<typeof computeReport>, id: string) {
  const m = report.metrics.find((x) => x.id === id);
  if (!m) throw new Error(`métrique ${id} absente du rapport`);
  return m;
}

describe("tokenize", () => {
  it("normalise casse et ponctuation périphérique", () => {
    expect(tokenize("Donc, VOILÀ ! du coup.")).toEqual(["donc", "voilà", "du", "coup"]);
  });
  it("chaîne vide → aucun mot", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("countFillers — comptage des béquilles", () => {
  it("compte les mots simples, insensible à la casse et à la ponctuation", () => {
    const counts = countFillers("Donc voilà. Donc, encore donc !");
    expect(counts).toEqual([
      { filler: "donc", count: 3 },
      { filler: "voilà", count: 1 },
    ]);
  });

  it("les expressions multi-mots consomment leurs mots (« et voilà » ≠ « voilà »)", () => {
    const counts = countFillers("et voilà c'est fini");
    expect(counts).toEqual([{ filler: "et voilà", count: 1 }]);
  });

  it("« du coup » est compté comme expression, pas comme deux mots", () => {
    const counts = countFillers("du coup on continue du coup");
    expect(counts).toEqual([{ filler: "du coup", count: 2 }]);
  });

  it("regroupe les variantes (« heu » → « euh »)", () => {
    const counts = countFillers("euh heu hem");
    expect(counts).toEqual([{ filler: "euh", count: 3 }]);
  });

  it("ordre déterministe : fréquence décroissante puis alphabétique", () => {
    const counts = countFillers("bref genre bref genre alors");
    expect(counts.map((c) => c.filler)).toEqual(["bref", "genre", "alors"]);
  });

  it("texte sans béquille → liste vide", () => {
    expect(countFillers("le produit fonctionne correctement")).toEqual([]);
  });
});

describe("computeReport — débit", () => {
  it("session trop courte (< 10 s) → métrique absente, jamais un faux verdict", () => {
    const r = computeReport({ transcript: "bonjour à tous", durationMs: 5_000 });
    expect(metric(r, "debit").level).toBe("absent");
  });

  it("débit confortable → bon (120 mots en 60 s = 120 mots/min)", () => {
    const transcript = Array(120).fill("mot").join(" ");
    const r = computeReport({ transcript, durationMs: 60_000 });
    const m = metric(r, "debit");
    expect(m.level).toBe("bon");
    expect(m.value).toBe(120);
  });

  it("débit lent → attention puis alerte selon le seuil", () => {
    const cent = Array(100).fill("mot").join(" ");
    expect(metric(computeReport({ transcript: cent, durationMs: 60_000 }), "debit").level).toBe(
      "attention",
    ); // 100/min
    expect(metric(computeReport({ transcript: cent, durationMs: 120_000 }), "debit").level).toBe(
      "alerte",
    ); // 50/min
  });

  it("débit très rapide → alerte (200 mots/min)", () => {
    const transcript = Array(200).fill("mot").join(" ");
    expect(metric(computeReport({ transcript, durationMs: 60_000 }), "debit").level).toBe("alerte");
  });
});

describe("computeReport — béquilles", () => {
  it("aucune béquille → bon, avec un résumé positif", () => {
    const transcript = Array(50).fill("contenu").join(" ");
    const m = metric(computeReport({ transcript, durationMs: 60_000 }), "bequilles");
    expect(m.level).toBe("bon");
    expect(m.value).toBe(0);
  });

  it("densité élevée → alerte, top des béquilles dans les détails", () => {
    // 10 béquilles pour 40 mots = 25 pour 100 mots.
    const transcript = ("donc mot mot " + "euh ").repeat(10);
    const m = metric(computeReport({ transcript, durationMs: 60_000 }), "bequilles");
    expect(m.level).toBe("alerte");
    expect(m.details.length).toBeGreaterThan(0);
    expect(m.details[0]).toContain("donc");
  });
});

describe("computeReport — phrases", () => {
  it("sans ponctuation → métrique absente (jamais un verdict sur du bruit)", () => {
    const transcript = Array(80).fill("mot").join(" ");
    expect(metric(computeReport({ transcript, durationMs: 60_000 }), "phrases").level).toBe(
      "absent",
    );
  });

  it("phrases courtes → bon", () => {
    const transcript = "Je commence. Je continue mon exposé. Je conclus rapidement. Merci à tous.";
    expect(metric(computeReport({ transcript, durationMs: 60_000 }), "phrases").level).toBe("bon");
  });

  it("phrases interminables → alerte, avec le compte des phrases trop longues", () => {
    const longue = Array(40).fill("mot").join(" ");
    const m = metric(
      computeReport({ transcript: `${longue}. ${longue}.`, durationMs: 60_000 }),
      "phrases",
    );
    expect(m.level).toBe("alerte");
    expect(m.details[0]).toContain("2 phrases");
  });
});

describe("computeReport — structure", () => {
  const remplissage = Array(80).fill("contenu").join(" ");

  it("session trop courte (< 60 mots) → absente", () => {
    const r = computeReport({ transcript: "je vais vous présenter ceci", durationMs: 60_000 });
    expect(metric(r, "structure").level).toBe("absent");
  });

  it("plan annoncé + conclusion marquée → bon", () => {
    const transcript = `je vais vous présenter mon plan en trois parties ${remplissage} pour conclure merci de votre attention`;
    const m = metric(computeReport({ transcript, durationMs: 60_000 }), "structure");
    expect(m.level).toBe("bon");
  });

  it("intro sans conclusion → attention", () => {
    const transcript = `dans un premier temps ${remplissage}`;
    expect(metric(computeReport({ transcript, durationMs: 60_000 }), "structure").level).toBe(
      "attention",
    );
  });

  it("ni intro ni conclusion → alerte, détails explicites", () => {
    const m = metric(computeReport({ transcript: remplissage, durationMs: 60_000 }), "structure");
    expect(m.level).toBe("alerte");
    expect(m.details).toHaveLength(2);
  });
});

describe("computeReport — session réelle du 21 août (77 mots, 1 min 13)", () => {
  const report = computeReport({ transcript: SESSION_REELLE, durationMs: 73_000 });

  it("le rapport contient toujours les 4 métriques, dans un ordre stable", () => {
    expect(report.metrics.map((m) => m.id)).toEqual(["debit", "bequilles", "phrases", "structure"]);
  });

  it("débit lent détecté (≈63 mots/min → alerte)", () => {
    const m = metric(report, "debit");
    expect(m.level).toBe("alerte");
    expect(m.value).toBeLessThan(70);
  });

  it("les béquilles réellement prononcées sont détectées (donc, en effet, du coup, ouais, et voilà)", () => {
    const counts = countFillers(SESSION_REELLE);
    const fillers = counts.map((c) => c.filler);
    expect(fillers).toEqual(
      expect.arrayContaining(["donc", "en effet", "du coup", "ouais", "et voilà"]),
    );
    const m = metric(report, "bequilles");
    expect(m.level).not.toBe("bon");
  });

  it("l'annonce « je vais vous présenter » est reconnue, l'absence de conclusion aussi", () => {
    const m = metric(report, "structure");
    expect(m.level).toBe("attention");
    expect(m.details[0]).toContain("je vais vous présenter");
  });

  it("le rapport est déterministe : deux calculs identiques → résultats identiques", () => {
    const again = computeReport({ transcript: SESSION_REELLE, durationMs: 73_000 });
    expect(again).toEqual(report);
  });
});

describe("SEUILS — les constantes restent critiquables", () => {
  it("les seuils sont exportés et cohérents", () => {
    expect(SEUILS.debit.bonMin).toBeLessThan(SEUILS.debit.bonMax);
    expect(SEUILS.bequillesPour100.bon).toBeLessThan(SEUILS.bequillesPour100.attention);
  });
});
