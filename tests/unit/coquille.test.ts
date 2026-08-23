import { describe, expect, it } from "vitest";
import { construireNotifications, lireVues, marquerVues, nonVues } from "../../lib/notifications";
import { rechercher, normaliser, PAGES } from "../../lib/recherche";
import { chiffresSemaine, dateLongue, salutation, debit } from "../../lib/accueil";
import type { ResumeModule } from "../../lib/preferences";
import type { SessionRecord } from "../../lib/types";

function resume(partiel: Partial<ResumeModule>): ResumeModule {
  return { id: "soutenance", nom: "Soutenance", emoji: "", hub: "/app/soutenance", jours: null, pourcent: null, sousTitre: "", prochaineAction: { titre: "Donne ta date", lien: "/app/soutenance" }, ...partiel };
}

function session(partiel: Partial<SessionRecord>): SessionRecord {
  return { id: "s1", startedAt: "2026-08-22T10:00:00.000Z", durationMs: 600_000, transcript: "Bonjour à tous, je vais présenter mon projet", wordCount: 120, ...partiel };
}

class Memoire {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("notifications", () => {
  it("classe les échéances proches en attention, les lointaines en info, et ignore au-delà de 14 jours", () => {
    const liste = construireNotifications({
      resumes: [resume({ id: "pitch", nom: "Pitch", jours: 10 }), resume({ jours: 2, pourcent: 40 }), resume({ id: "concours", nom: "Concours", jours: 30 }), resume({ id: "entretien", nom: "Entretien", jours: 6 })],
      quota: null,
      qdjFaite: true,
      aujourdhui: "2026-08-23",
    });
    expect(liste.map((n) => n.niveau)).toEqual(["attention", "info", "info"]);
    expect(liste.map((n) => n.titre)).toEqual(["J-2 · Soutenance", "J-6 · Entretien", "J-10 · Pitch"]);
    expect(liste[0]!.titre).toBe("J-2 · Soutenance");
    expect(liste[0]!.detail).toContain("Prêt à 40 %");
    expect(liste[0]!.id).toBe("echeance:soutenance:2026-08-23");
  });

  it("propose de raconter l'oral la semaine qui suit, et signale le jour J", () => {
    const liste = construireNotifications({ resumes: [resume({ jours: -3 }), resume({ id: "pitch", nom: "Pitch", jours: 0 })], quota: null, qdjFaite: true, aujourdhui: "2026-08-23" });
    expect(liste[0]!.titre).toContain("aujourd'hui");
    expect(liste[1]!.titre).toBe("Comment s'est passé ton oral ?");
    expect(liste[1]!.niveau).toBe("succes");
    expect(liste[1]!.id).toBe("retour:soutenance");
  });

  it("rappelle la question du jour et le quota à 75 % puis à 100 %", () => {
    const base = { resumes: [], qdjFaite: false, aujourdhui: "2026-08-23" };
    const a = construireNotifications({ ...base, quota: { type: "compte", appels: 60, limite: 80, reste: 20, mois: "2026-08", reinitialisation: "2026-09-01" } });
    expect(a.map((n) => n.id)).toEqual(["qdj:2026-08-23", "quota-haut:2026-08"]);
    const b = construireNotifications({ ...base, quota: { type: "compte", appels: 80, limite: 80, reste: 0, mois: "2026-08", reinitialisation: "2026-09-01" } });
    expect(b[0]!.id).toBe("quota-plein:2026-08");
    expect(b[0]!.niveau).toBe("attention");
  });

  it("se souvient de ce qui a été vu, et ne garde que 60 identifiants", () => {
    const st = new Memoire();
    expect(lireVues(st).size).toBe(0);
    const vues = marquerVues(st, Array.from({ length: 70 }, (_, i) => `n${i}`));
    expect(vues.size).toBe(60);
    expect(vues.has("n9")).toBe(false);
    expect(vues.has("n69")).toBe(true);
    const liste = construireNotifications({ resumes: [], quota: null, qdjFaite: false, aujourdhui: "2026-08-23" });
    expect(nonVues(liste, vues)).toBe(1);
    expect(nonVues(liste, marquerVues(st, liste.map((n) => n.id)))).toBe(0);
  });
});

describe("recherche", () => {
  it("ignore la casse et les accents, et ne répond pas sous 2 caractères", () => {
    expect(normaliser("Écoles Préparées")).toBe("ecoles preparees");
    expect(rechercher("é", [])).toEqual({ pages: [], sessions: [] });
    const r = rechercher("ENTRETIEN", []);
    expect(r.pages[0]!.lien).toBe("/app/entretien");
    expect(r.pages.length).toBeLessThanOrEqual(5);
  });

  it("remonte les pages par leurs mots cachés et les sessions par leur transcription", () => {
    expect(rechercher("leitner", []).pages[0]!.lien).toBe("/app/fiches");
    const r = rechercher("mon projet", [session({})]);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0]!.titre).toMatch(/^Soutenance · 22 août · 10 min$/);
    expect(r.sessions[0]!.extrait).toContain("mon projet");
    expect(r.sessions[0]!.lien).toBe("/app/sessions?q=mon%20projet");
  });

  it("exige tous les termes", () => {
    expect(rechercher("guide salaire", []).pages.map((p) => p.lien)).toEqual(["/app/guide-entretien"]);
    expect(rechercher("guide zzz", []).pages).toEqual([]);
    expect(PAGES.every((p) => p.lien.startsWith("/app"))).toBe(true);
  });
});

describe("accueil", () => {
  const maintenant = new Date("2026-08-23T12:00:00.000Z");
  it("compte la semaine, la précédente, les minutes et le mois", () => {
    const sessions = [
      session({ id: "a", startedAt: "2026-08-22T10:00:00.000Z", durationMs: 600_000, wordCount: 100 }),
      session({ id: "b", startedAt: "2026-08-20T10:00:00.000Z", durationMs: 300_000, wordCount: 50 }),
      session({ id: "c", startedAt: "2026-08-12T10:00:00.000Z" }),
      session({ id: "d", startedAt: "2026-07-30T10:00:00.000Z" }),
    ];
    const c = chiffresSemaine(sessions, { jours: ["2026-08-22", "2026-08-23"] }, maintenant);
    expect(c.sessions).toBe(2);
    expect(c.sessionsSemainePrecedente).toBe(1);
    expect(c.minutes).toBe(15);
    expect(c.mots).toBe(150);
    expect(c.serie).toBe(2);
    expect(c.sessionsMois).toBe(3);
  });

  it("salue selon l'heure et écrit la date avec une seule capitale", () => {
    expect(salutation(new Date("2026-08-23T09:00:00"))).toBe("Bonjour");
    expect(salutation(new Date("2026-08-23T21:00:00"))).toBe("Bonsoir");
    expect(dateLongue(maintenant)).toBe("Dimanche 23 août");
  });

  it("ne calcule pas de débit sur une session trop courte", () => {
    expect(debit(session({ durationMs: 5_000, wordCount: 50 }))).toBeNull();
    expect(debit(session({ durationMs: 60_000, wordCount: 130 }))).toBe(130);
  });
});
