import { describe, it, expect } from "vitest";
import { detectTrend, buildTrendReport, SEUILS_TENDANCES } from "../../lib/trends";
import type { SessionRecord } from "../../lib/types";

/** Fabrique une session : `mots` mots par phrase de 10, durée donnée. */
function sessionAvec(opts: {
  id: string;
  jour: number;
  texte: string;
  durationMs?: number;
}): SessionRecord {
  return {
    id: opts.id,
    startedAt: `2026-08-${String(opts.jour).padStart(2, "0")}T10:00:00.000Z`,
    durationMs: opts.durationMs ?? 60_000,
    transcript: opts.texte,
    wordCount: opts.texte.split(/\s+/).length,
  };
}

/** Texte de n mots avec b béquilles « euh », ponctué toutes les 12 unités. */
function texte(n: number, bequilles = 0): string {
  const mots: string[] = [];
  for (let i = 0; i < n; i++) mots.push(i < bequilles ? "euh" : "contenu");
  return mots.map((m, i) => ((i + 1) % 12 === 0 ? `${m}.` : m)).join(" ");
}

function trend(report: ReturnType<typeof buildTrendReport>, id: string) {
  const t = report.find((x) => x.id === id);
  if (!t) throw new Error(`tendance ${id} absente`);
  return t;
}

describe("detectTrend — le cœur, sur des séries de pénalités", () => {
  it("moins de minSessions points → absent, sans exception au seuil", () => {
    expect(detectTrend([])).toBe("absent");
    expect(detectTrend([50])).toBe("absent");
    expect(detectTrend([50, 10])).toBe("absent");
  });

  it("pénalités qui baissent nettement → progression", () => {
    expect(detectTrend([80, 50, 20])).toBe("progression");
  });

  it("pénalités qui montent nettement → régression", () => {
    expect(detectTrend([10, 40, 70])).toBe("regression");
  });

  it("variation sous le seuil → stagnation (pas de sur-interprétation du bruit)", () => {
    expect(detectTrend([50, 52, 48, 51])).toBe("stagnation");
    expect(detectTrend([0, 0, 0])).toBe("stagnation");
  });

  it("un pic au point central (série impaire) s'annule : il pèse dans les deux moitiés", () => {
    expect(detectTrend([30, 28, 90, 29, 31])).toBe("stagnation");
  });

  it("limite documentée : un pic en début de série lit une progression (méthode des moitiés)", () => {
    // Ce comportement est assumé et documenté : la méthode simple choisie dans
    // MISSION.md compare des moyennes de moitiés — un pic précoce pèse sur la
    // première. Si cela devient gênant en usage réel, passer à la médiane.
    expect(detectTrend([30, 90, 30, 28])).toBe("progression");
  });
});

describe("buildTrendReport — sur des sessions complètes", () => {
  it("moins de 3 sessions → toutes les tendances absentes, avec le compte restant", () => {
    const report = buildTrendReport([
      sessionAvec({ id: "a", jour: 1, texte: texte(120) }),
      sessionAvec({ id: "b", jour: 2, texte: texte(120) }),
    ]);
    for (const t of report) {
      expect(t.trend).toBe("absent");
      expect(t.insight).toContain("Encore 1 session");
    }
  });

  it("les béquilles qui fondent sur 3 sessions → progression, valeurs brutes dans l'insight", () => {
    const report = buildTrendReport([
      sessionAvec({ id: "a", jour: 1, texte: texte(100, 12) }), // 12 %
      sessionAvec({ id: "b", jour: 2, texte: texte(100, 6) }), // 6 %
      sessionAvec({ id: "c", jour: 3, texte: texte(100, 0) }), // 0 %
    ]);
    const t = trend(report, "bequilles");
    expect(t.trend).toBe("progression");
    expect(t.firstValue).toBe(12);
    expect(t.lastValue).toBe(0);
    expect(t.insight).toContain("12 → 0");
  });

  it("stagner à zéro béquille → message « acquis », pas « point de travail »", () => {
    const report = buildTrendReport([
      sessionAvec({ id: "a", jour: 1, texte: texte(100) }),
      sessionAvec({ id: "b", jour: 2, texte: texte(100) }),
      sessionAvec({ id: "c", jour: 3, texte: texte(100) }),
    ]);
    const t = trend(report, "bequilles");
    expect(t.trend).toBe("stagnation");
    expect(t.insight).toContain("acquis");
  });

  it("stagner à un mauvais niveau → « point de travail prioritaire »", () => {
    const report = buildTrendReport([
      sessionAvec({ id: "a", jour: 1, texte: texte(100, 10) }),
      sessionAvec({ id: "b", jour: 2, texte: texte(100, 11) }),
      sessionAvec({ id: "c", jour: 3, texte: texte(100, 10) }),
    ]);
    const t = trend(report, "bequilles");
    expect(t.trend).toBe("stagnation");
    expect(t.insight).toContain("prioritaire");
  });

  it("les sessions où une métrique est absente ne comptent pas pour son seuil", () => {
    // 4 sessions, mais 2 trop courtes pour le débit → 2 points mesurables < minSessions.
    const report = buildTrendReport([
      sessionAvec({ id: "a", jour: 1, texte: texte(20), durationMs: 5_000 }),
      sessionAvec({ id: "b", jour: 2, texte: texte(20), durationMs: 5_000 }),
      sessionAvec({ id: "c", jour: 3, texte: texte(120) }),
      sessionAvec({ id: "d", jour: 4, texte: texte(120) }),
    ]);
    const t = trend(report, "debit");
    expect(t.trend).toBe("absent");
    expect(t.sessionsCount).toBe(2);
  });

  it("l'ordre d'entrée des sessions est sans effet (retri chronologique interne)", () => {
    const sessions = [
      sessionAvec({ id: "c", jour: 3, texte: texte(100, 0) }),
      sessionAvec({ id: "a", jour: 1, texte: texte(100, 12) }),
      sessionAvec({ id: "b", jour: 2, texte: texte(100, 6) }),
    ];
    const desordre = buildTrendReport(sessions);
    const ordre = buildTrendReport([...sessions].reverse());
    expect(desordre).toEqual(ordre);
    expect(trend(desordre, "bequilles").trend).toBe("progression");
  });

  it("la fenêtre est bornée aux 6 dernières sessions mesurables", () => {
    // 8 sessions : les 2 premières très mauvaises, hors fenêtre → la tendance
    // se calcule sur les 6 dernières (stables) → stagnation, pas progression.
    const sessions = [
      sessionAvec({ id: "s1", jour: 1, texte: texte(100, 14) }),
      sessionAvec({ id: "s2", jour: 2, texte: texte(100, 14) }),
      ...[3, 4, 5, 6, 7, 8].map((j) =>
        sessionAvec({ id: `s${j}`, jour: j, texte: texte(100, 5) }),
      ),
    ];
    const t = trend(buildTrendReport(sessions), "bequilles");
    expect(t.sessionsCount).toBe(SEUILS_TENDANCES.fenetre);
    expect(t.trend).toBe("stagnation");
    expect(t.firstValue).toBe(5);
  });

  it("une session à confiance basse ne pollue pas la tendance du débit", () => {
    // 3 sessions au débit stable, dont une mal transcrite : son débit est
    // absent, donc elle ne compte pas — et la tendance retombe sous le seuil.
    const sessions = [
      sessionAvec({ id: "a", jour: 1, texte: texte(120) }),
      { ...sessionAvec({ id: "b", jour: 2, texte: texte(60) }), confidence: 0.5 },
      sessionAvec({ id: "c", jour: 3, texte: texte(120) }),
    ];
    const t = trend(buildTrendReport(sessions), "debit");
    expect(t.sessionsCount).toBe(2);
    expect(t.trend).toBe("absent");
  });

  it("le rapport contient toujours les 4 métriques dans un ordre stable", () => {
    const report = buildTrendReport([]);
    expect(report.map((t) => t.id)).toEqual(["debit", "bequilles", "phrases", "structure"]);
  });

  it("déterminisme : deux calculs identiques → résultats identiques", () => {
    const sessions = [
      sessionAvec({ id: "a", jour: 1, texte: texte(100, 8) }),
      sessionAvec({ id: "b", jour: 2, texte: texte(110, 4) }),
      sessionAvec({ id: "c", jour: 3, texte: texte(120, 1) }),
    ];
    expect(buildTrendReport(sessions)).toEqual(buildTrendReport(sessions));
  });
});
