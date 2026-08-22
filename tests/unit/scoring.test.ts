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

  it("confiance de transcription basse → absent : « je t'ai mal entendu » ≠ « tu parles lentement »", () => {
    const transcript = Array(60).fill("mot").join(" ");
    const m = metric(computeReport({ transcript, durationMs: 73_000, confidence: 0.62 }), "debit");
    expect(m.level).toBe("absent");
    expect(m.summary).toContain("manqué une partie de tes mots");
    expect(m.details[0]).toContain("62 %");
  });

  it("confiance haute → le débit est calculé normalement", () => {
    const transcript = Array(120).fill("mot").join(" ");
    const m = metric(computeReport({ transcript, durationMs: 60_000, confidence: 0.94 }), "debit");
    expect(m.level).toBe("bon");
    expect(m.value).toBe(120);
  });

  it("confiance inconnue (sessions d'avant le champ) → comportement inchangé", () => {
    const transcript = Array(120).fill("mot").join(" ");
    expect(metric(computeReport({ transcript, durationMs: 60_000 }), "debit").value).toBe(120);
  });
});

describe("computeReport — tenue du temps (mode soutenance)", () => {
  const dixMinutes = 600_000;

  it("sans durée visée → absent, avec l'invitation à choisir un format", () => {
    const m = metric(computeReport({ transcript: "bonjour", durationMs: 60_000 }), "temps");
    expect(m.level).toBe("absent");
    expect(m.summary).toContain("Entraînement libre");
  });

  it("dans les 10 % de la cible → bon", () => {
    const m = metric(
      computeReport({ transcript: "x", durationMs: 570_000, targetDurationMs: dixMinutes }),
      "temps",
    );
    expect(m.level).toBe("bon");
    expect(m.summary).toContain("tu tiens ton format");
  });

  it("dépassement franc → alerte, message orienté jury", () => {
    const m = metric(
      computeReport({ transcript: "x", durationMs: 780_000, targetDurationMs: dixMinutes }),
      "temps",
    );
    expect(m.level).toBe("alerte");
    expect(m.summary).toContain("dépasses");
    expect(m.details[0]).toContain("+30 %");
  });

  it("trop court → alerte avec un message différent du dépassement", () => {
    const m = metric(
      computeReport({ transcript: "x", durationMs: 300_000, targetDurationMs: dixMinutes }),
      "temps",
    );
    expect(m.level).toBe("alerte");
    expect(m.summary).toContain("court");
    expect(m.details[0]).toContain("−50 %");
  });

  it("écart intermédiaire → attention", () => {
    const m = metric(
      computeReport({ transcript: "x", durationMs: 690_000, targetDurationMs: dixMinutes }),
      "temps",
    );
    expect(m.level).toBe("attention");
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

  it("phrases de longueur naturelle → bon", () => {
    const transcript =
      "Je commence par vous présenter le contexte général de mon travail. " +
      "Ensuite je détaille les trois missions techniques que j'ai réalisées cet été. " +
      "Enfin je reviens sur les compétences que ce projet m'a permis de développer.";
    expect(metric(computeReport({ transcript, durationMs: 60_000 }), "phrases").level).toBe("bon");
  });

  it("discours haché par la transcription (moyenne < 7 mots) → absent, jamais un faux « bon »", () => {
    // Bug réel de la session n°2 : « Oh, j'ai travaillé. Sur une application. »
    const transcript = "Oh, j'ai travaillé. Sur une application. L'analyse. Les appels ? Le code.";
    const m = metric(computeReport({ transcript, durationMs: 60_000 }), "phrases");
    expect(m.level).toBe("absent");
    expect(m.summary).toContain("haché");
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

  it("le rapport contient toujours les 5 métriques, dans un ordre stable", () => {
    expect(report.metrics.map((m) => m.id)).toEqual([
      "temps",
      "debit",
      "bequilles",
      "phrases",
      "structure",
    ]);
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

describe("computeReport — session réelle n°2 (discours préparé, transcription hachée)", () => {
  /** Transcription brute de la session réelle n°2 : discours structuré et sans
   *  béquille, mais haché par la reconnaissance vocale. */
  const SESSION_REELLE_2 = `Bonjour, je vais vous présenter 3 points principaux. Premièrement mon mon stage chez propolis. Oh, j'ai travaillé. Sur une application de coaching commercial basée sur l'intelligence artificielle. Deuxièmement ? Émission technique. Que j'ai réalisé. L'analyse. Les appels ? Il a détection de tendance longitudinale. Troisièmement. Ce que j'ai appris est comment ? Je l'applique aujourd'hui. Dans mes projets personnels ? Pour conclure. Sauvetage. De comprendre. Système IA. Repose sur la rigoureux. Code déterministe. Pas sur le modèle de langage seul.`;
  const report = computeReport({ transcript: SESSION_REELLE_2, durationMs: 96_000 });

  it("aucune béquille — le discours préparé est réellement propre", () => {
    const m = metric(report, "bequilles");
    expect(m.level).toBe("bon");
    expect(m.value).toBe(0);
  });

  it("phrases → absent : le hachage de la transcription ne donne pas un faux « bon »", () => {
    expect(metric(report, "phrases").level).toBe("absent");
  });

  it("le « pour conclure » suivi de plusieurs phrases est bien capté (fenêtre élargie) → structure bonne", () => {
    const m = metric(report, "structure");
    expect(m.level).toBe("bon");
    expect(m.details[1]).toContain("pour conclure");
  });

  it("débit lent détecté (75 mots en 1 min 36)", () => {
    expect(metric(report, "debit").level).toBe("alerte");
  });
});

describe("computeReport — session réelle n°3 (le produit se présente lui-même)", () => {
  /** Transcription brute de la session réelle n°3 : « Pour conclure » prononcé,
   *  mais transcrit « Conclure ? » — le marqueur exact le ratait. */
  const SESSION_REELLE_3 = `Bonjour. Pouvez-vous présenter ? Mon projet, soutenance, coach. En 3 points. Premièrement, le problème. Les étudiants s'entraînent. Aura sans aucune retour objectif. Ton mémoire, douleur, progression. Deuxièmement ? Une application ? Je pense que votre discours. Mesure votre débit. Détecte vos vos mots, buckles. Vos mots béquil ? Ils se souviennent. Donc, Troisièmement. La philosophie technique. Chaque score est calculé par du code déterministe. Et test. Le modèle de langage ne décide jamais d'un chiffre. Conclure ? Ce projet m'a permis de construire ce que j'avais proposé en stage, mais jamais codé. Une vraie analyse longitudinale de la progression. Hum, c'est fini.`;
  const report = computeReport({ transcript: SESSION_REELLE_3, durationMs: 122_000 });

  it("« Conclure ? » (pour conclure amputé par la transcription) est capté par le marqueur de repli", () => {
    const m = metric(report, "structure");
    expect(m.level).toBe("bon");
    expect(m.details[1]).toContain("conclure");
  });

  it("« c'est fini » est reconnu comme fin marquée", () => {
    expect(metric(report, "structure").details[1]).toContain("fini");
  });

  it("l'intro est reconnue malgré « je vais vous présenter » transcrit « Pouvez-vous présenter »", () => {
    // Grâce à « en 3 points » et « premièrement ».
    expect(metric(report, "structure").details[0]).toContain("premièrement");
  });

  it("phrases → absent (hachage), béquilles contenues, débit lent", () => {
    expect(metric(report, "phrases").level).toBe("absent");
    expect(metric(report, "bequilles").level).toBe("bon");
    expect(metric(report, "debit").level).toBe("alerte");
  });
});

describe("SEUILS — les constantes restent critiquables", () => {
  it("les seuils sont exportés et cohérents", () => {
    expect(SEUILS.debit.bonMin).toBeLessThan(SEUILS.debit.bonMax);
    expect(SEUILS.bequillesPour100.bon).toBeLessThan(SEUILS.bequillesPour100.attention);
  });
});
