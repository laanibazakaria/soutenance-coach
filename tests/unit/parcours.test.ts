import { describe, it, expect } from "vitest";
import {
  construirePlan,
  fusionnerParcours,
  joursEntre,
  ajouterJours,
  estParcours,
  ETAPES,
  type Parcours,
  type Contexte,
} from "../../lib/parcours";
import { lireParcours, sauverParcours, marquerEtape, detecterContexte } from "../../lib/parcours/persistance";
import type { SessionRecord } from "../../lib/types";

const vide: Contexte = { sessions: [], deckPresent: false, pitchGenere: false, questionsGenerees: false, avisCoach: false, fichesRevisees: false, blancheFaite: false };

const parcours = (extra: Partial<Parcours> = {}): Parcours => ({
  dateSoutenance: "2026-09-15",
  type: "pfe",
  dureeMin: 20,
  creeLe: "2026-09-01",
  etapesFaites: {},
  misAJourLe: "2026-09-01T10:00:00.000Z",
  ...extra,
});

let compteur = 0;
const session = (extra: Partial<SessionRecord> = {}): SessionRecord => ({
  id: `s${++compteur}`,
  startedAt: "2026-09-02T10:00:00.000Z",
  durationMs: 60_000,
  transcript: "Bonjour, je vais vous présenter mon projet de fin d'études en trois parties.",
  wordCount: 13,
  ...extra,
});

function memoire(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
  };
}

describe("dates civiles", () => {
  it("compte les jours sans effet de fuseau ni d'heure d'été", () => {
    expect(joursEntre("2026-09-01", "2026-09-15")).toBe(14);
    expect(joursEntre("2026-09-15", "2026-09-01")).toBe(-14);
    expect(joursEntre("2026-10-24", "2026-10-26")).toBe(2); // passage à l'heure d'hiver
    expect(ajouterJours("2026-08-30", 3)).toBe("2026-09-02");
    expect(ajouterJours("2026-09-01", -1)).toBe("2026-08-31");
  });
});

describe("construirePlan — répartition", () => {
  it("commence le jour de création, réserve la veille et le jour J, reste dans la fenêtre", () => {
    const plan = construirePlan(parcours(), vide, "2026-09-01");
    const parId = Object.fromEntries(plan.etapes.map((e) => [e.id, e.jour]));
    expect(parId.slides).toBe("2026-09-01");
    expect(parId.relecture).toBe("2026-09-14");
    expect(parId.jourJ).toBe("2026-09-15");
    for (const e of plan.etapes) {
      expect(joursEntre("2026-09-01", e.jour)).toBeGreaterThanOrEqual(0);
      expect(joursEntre(e.jour, "2026-09-15")).toBeGreaterThanOrEqual(0);
    }
    // L'ordre pédagogique est respecté dans le temps.
    const jours = plan.etapes.map((e) => e.jour);
    expect([...jours].sort()).toEqual(jours);
  });

  it("sur une fenêtre d'un jour, tout tombe aujourd'hui — sans planter", () => {
    const plan = construirePlan(parcours({ creeLe: "2026-09-15" }), vide, "2026-09-15");
    expect(new Set(plan.etapes.map((e) => e.jour))).toEqual(new Set(["2026-09-15"]));
    expect(plan.joursRestants).toBe(0);
    expect(plan.passee).toBe(false);
  });

  it("signale une soutenance passée", () => {
    expect(construirePlan(parcours(), vide, "2026-09-16").passee).toBe(true);
  });
});

describe("construirePlan — états et détection", () => {
  it("classe retard / aujourd'hui / à venir, et liste ce qui est à faire", () => {
    const plan = construirePlan(parcours(), vide, "2026-09-05");
    const etats = Object.fromEntries(plan.etapes.map((e) => [e.id, e.etat]));
    expect(etats.slides).toBe("retard");
    expect(etats.jourJ).toBe("avenir");
    expect(plan.aFaire.every((e) => !e.faite && joursEntre("2026-09-05", e.jour) <= 0)).toBe(true);
    expect(plan.prochaine?.etat).toBe("avenir");
  });

  it("détecte depuis l'activité : support, pitch, sessions, format réel, dans les temps, tendances", () => {
    const ctx: Contexte = {
      sessions: [
        session(),
        session({ targetDurationMs: 60_000, durationMs: 57_000 }), // ± 10 % → dans les temps
        session(),
      ],
      deckPresent: true,
      pitchGenere: true,
      questionsGenerees: true,
      avisCoach: false,
      fichesRevisees: false,
      blancheFaite: false,
    };
    const plan = construirePlan(parcours(), ctx, "2026-09-05");
    const faite = Object.fromEntries(plan.etapes.map((e) => [e.id, e.faite]));
    for (const id of ["slides", "pitch", "session1", "questions", "session-chrono", "tendances", "session-temps"]) {
      expect(faite[id], id).toBe(true);
    }
    expect(faite.jury).toBe(false); // rien ne le prouve sans passer par la page
    expect(plan.etapes.find((e) => e.id === "slides")?.source).toBe("auto");
  });

  it("une session hors tolérance ne vaut pas « dans les temps »", () => {
    const ctx = { ...vide, sessions: [session({ targetDurationMs: 60_000, durationMs: 48_000 })] };
    const plan = construirePlan(parcours(), ctx, "2026-09-05");
    expect(plan.etapes.find((e) => e.id === "session-temps")?.faite).toBe(false);
    expect(plan.etapes.find((e) => e.id === "session-chrono")?.faite).toBe(true);
  });

  it("la coche manuelle compte, et le jour J n'entre pas dans la progression", () => {
    const plan = construirePlan(
      parcours({ etapesFaites: { jury: "2026-09-04T10:00:00.000Z", jourJ: "x" } }),
      vide,
      "2026-09-05",
    );
    expect(plan.etapes.find((e) => e.id === "jury")?.source).toBe("manuel");
    expect(plan.progression.total).toBe(ETAPES.length - 1);
    expect(plan.progression.faites).toBe(1);
  });
});

describe("fusionnerParcours", () => {
  it("prend les champs du plus récent et l'union des étapes, date la plus ancienne", () => {
    const local = parcours({
      dateSoutenance: "2026-09-20",
      misAJourLe: "2026-09-03T00:00:00.000Z",
      etapesFaites: { slides: "2026-09-03T00:00:00.000Z" },
    });
    const distant = parcours({
      misAJourLe: "2026-09-02T00:00:00.000Z",
      etapesFaites: { slides: "2026-09-01T00:00:00.000Z", jury: "2026-09-02T00:00:00.000Z" },
    });
    const f = fusionnerParcours(local, distant)!;
    expect(f.dateSoutenance).toBe("2026-09-20");
    expect(f.etapesFaites).toEqual({ slides: "2026-09-01T00:00:00.000Z", jury: "2026-09-02T00:00:00.000Z" });
    expect(fusionnerParcours(null, distant)).toBe(distant);
    expect(fusionnerParcours(local, null)).toBe(local);
  });
});

describe("persistance", () => {
  it("relit ce qu'elle écrit, rejette le corrompu et l'invalide", () => {
    const st = memoire();
    sauverParcours(st, parcours());
    expect(lireParcours(st)).toEqual(parcours());
    st.setItem("sc.parcours.v1", "{pas du json");
    expect(lireParcours(st)).toBeNull();
    st.setItem("sc.parcours.v1", JSON.stringify({ dateSoutenance: "demain" }));
    expect(lireParcours(st)).toBeNull();
    expect(estParcours(parcours())).toBe(true);
  });

  it("marquerEtape est idempotent et horodate la modification", () => {
    const st = memoire();
    expect(marquerEtape(st, "jury", true)).toBeNull(); // pas de parcours : rien
    sauverParcours(st, parcours());
    const a = marquerEtape(st, "jury", true, "2026-09-04T10:00:00.000Z")!;
    expect(a.etapesFaites.jury).toBe("2026-09-04T10:00:00.000Z");
    expect(a.misAJourLe).toBe("2026-09-04T10:00:00.000Z");
    const b = marquerEtape(st, "jury", true, "2026-09-05T10:00:00.000Z")!;
    expect(b).toEqual(a);
    const c = marquerEtape(st, "jury", false, "2026-09-06T10:00:00.000Z")!;
    expect(c.etapesFaites.jury).toBeUndefined();
  });

  it("détecte le contexte depuis les clés du stockage", () => {
    const st = memoire({
      "sc.ia.v1:pitch:abc": "{}",
      "sc.ia.v1:questions-courantes": "[]",
      "sc.ia.v1:coach:s1": "{}",
      "sc.ia.v1:fiches-etats:x": "{}", // vide : aucune révision
    });
    const ctx = detecterContexte(st, []);
    expect(ctx).toEqual({ sessions: [], deckPresent: false, pitchGenere: true, questionsGenerees: true, avisCoach: true, fichesRevisees: false, blancheFaite: false });
    st.setItem("sc.ia.v1:fiches-etats:x", JSON.stringify({ f1: { niveau: 1 } }));
    expect(detecterContexte(st, []).fichesRevisees).toBe(true);
  });
});
