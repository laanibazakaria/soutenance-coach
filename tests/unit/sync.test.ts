import { describe, it, expect } from "vitest";
import { fusionnerSessions, sessionsAPousser, fusionnerDeck, fusionnerIa, viderDonneesLocales } from "../../lib/sync/merge";
import type { SessionRecord } from "../../lib/types";

const s = (id: string, startedAt: string, transcript = "x"): SessionRecord => ({
  id,
  startedAt,
  durationMs: 60_000,
  transcript,
  wordCount: 1,
});

describe("fusionnerSessions", () => {
  it("union sans doublon, triée de la plus récente à la plus ancienne", () => {
    const r = fusionnerSessions(
      [s("a", "2026-08-10T10:00:00Z"), s("b", "2026-08-12T10:00:00Z")],
      [s("b", "2026-08-12T10:00:00Z"), s("c", "2026-08-11T10:00:00Z")],
    );
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("ne perd jamais une session présente d'un seul côté", () => {
    const r = fusionnerSessions([s("seule-locale", "2026-08-01T00:00:00Z")], [s("seule-distante", "2026-08-02T00:00:00Z")]);
    expect(r).toHaveLength(2);
  });

  it("même id des deux côtés → un seul exemplaire, le local (vu en premier)", () => {
    const r = fusionnerSessions(
      [s("a", "2026-08-10T10:00:00Z", "version locale")],
      [s("a", "2026-08-10T10:00:00Z", "version distante")],
    );
    expect(r).toHaveLength(1);
    expect(r[0].transcript).toBe("version locale");
  });

  it("deux listes vides → vide", () => {
    expect(fusionnerSessions([], [])).toEqual([]);
  });
});

describe("sessionsAPousser", () => {
  it("ne renvoie que ce que le serveur ne connaît pas", () => {
    const r = sessionsAPousser(
      [s("a", "2026-08-10T10:00:00Z"), s("b", "2026-08-11T10:00:00Z")],
      [s("a", "2026-08-10T10:00:00Z")],
    );
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });
});

describe("fusionnerDeck", () => {
  const deck = (nom: string) => ({ nomFichier: nom, slides: [] });
  it("le local gagne quand il existe, sinon le distant", () => {
    expect(fusionnerDeck(deck("local.pdf"), deck("distant.pdf"))?.nomFichier).toBe("local.pdf");
    expect(fusionnerDeck(null, deck("distant.pdf"))?.nomFichier).toBe("distant.pdf");
    expect(fusionnerDeck(null, null)).toBeNull();
  });
});

describe("fusionnerIa", () => {
  it("union des clés, le local l'emporte en cas de conflit", () => {
    expect(fusionnerIa({ a: 1, c: "local" }, { b: 2, c: "distant" })).toEqual({ a: 1, b: 2, c: "local" });
  });
});

describe("viderDonneesLocales", () => {
  function faux(entrees: Record<string, string>) {
    const m = new Map(Object.entries(entrees));
    return {
      m,
      get length() { return m.size; },
      key: (i: number) => [...m.keys()][i] ?? null,
      removeItem: (k: string) => { m.delete(k); },
    };
  }

  it("efface sessions, support, cache IA et drapeau — et rien d'autre", () => {
    const st = faux({
      "sc.sessions.v1": "[]",
      "sc.deck.v1": "{}",
      "sc.connecte": "1",
      "sc.ia.v1:pitch:abc": "{}",
      "sc.ia.v1:questions:def": "{}",
      "sc.reglages.v1": "{\"theme\":\"sombre\"}",
      "autre-application": "x",
    });
    expect(viderDonneesLocales(st)).toBe(5);
    expect([...st.m.keys()]).toEqual(["sc.reglages.v1", "autre-application"]);
  });

  it("sur un stockage vide, ne fait rien", () => {
    expect(viderDonneesLocales(faux({}))).toBe(0);
  });
});
