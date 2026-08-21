import { describe, it, expect } from "vitest";
import { listSessions, saveSession, removeSession, countWords } from "../../lib/storage";
import type { SessionRecord, StorageLike } from "../../lib/types";

/** Stockage en mémoire — aucun DOM requis, conformément à la fiche de mission. */
function memoryStorage(initial?: Record<string, string>): StorageLike {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

function session(partial: Partial<SessionRecord> & { id: string }): SessionRecord {
  return {
    startedAt: "2026-08-18T10:00:00.000Z",
    durationMs: 120_000,
    transcript: "bonjour à tous",
    wordCount: 3,
    ...partial,
  };
}

describe("storage — persistance locale des sessions", () => {
  it("stockage vide → liste vide", () => {
    expect(listSessions(memoryStorage())).toEqual([]);
  });

  it("sauvegarde puis relecture d'une session", () => {
    const s = memoryStorage();
    saveSession(s, session({ id: "a" }));
    const sessions = listSessions(s);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("a");
  });

  it("la liste est triée de la plus récente à la plus ancienne", () => {
    const s = memoryStorage();
    saveSession(s, session({ id: "vieille", startedAt: "2026-08-01T08:00:00.000Z" }));
    saveSession(s, session({ id: "recente", startedAt: "2026-08-18T09:00:00.000Z" }));
    saveSession(s, session({ id: "moyenne", startedAt: "2026-08-10T12:00:00.000Z" }));
    expect(listSessions(s).map((x) => x.id)).toEqual(["recente", "moyenne", "vieille"]);
  });

  it("sauvegarder deux fois le même id remplace la session (pas de doublon)", () => {
    const s = memoryStorage();
    saveSession(s, session({ id: "a", transcript: "v1", wordCount: 1 }));
    saveSession(s, session({ id: "a", transcript: "v2 corrigée", wordCount: 2 }));
    const sessions = listSessions(s);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].transcript).toBe("v2 corrigée");
  });

  it("suppression par id", () => {
    const s = memoryStorage();
    saveSession(s, session({ id: "a" }));
    saveSession(s, session({ id: "b", startedAt: "2026-08-18T11:00:00.000Z" }));
    const rest = removeSession(s, "a");
    expect(rest.map((x) => x.id)).toEqual(["b"]);
    expect(listSessions(s).map((x) => x.id)).toEqual(["b"]);
  });

  it("stockage corrompu (JSON invalide) → liste vide, jamais d'exception", () => {
    const s = memoryStorage({ "sc.sessions.v1": "{pas du json[" });
    expect(listSessions(s)).toEqual([]);
  });

  it("stockage corrompu (mauvaise forme) → les entrées invalides sont filtrées", () => {
    const s = memoryStorage({
      "sc.sessions.v1": JSON.stringify([
        session({ id: "valide" }),
        { id: "invalide-sans-champs" },
        42,
        null,
      ]),
    });
    expect(listSessions(s).map((x) => x.id)).toEqual(["valide"]);
  });

  it("une sauvegarde sur stockage corrompu repart proprement", () => {
    const s = memoryStorage({ "sc.sessions.v1": "corrompu" });
    saveSession(s, session({ id: "a" }));
    expect(listSessions(s).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("countWords — comptage de mots robuste", () => {
  it("chaîne vide → 0", () => {
    expect(countWords("")).toBe(0);
  });
  it("espaces seuls → 0", () => {
    expect(countWords("   \n\t ")).toBe(0);
  });
  it("phrase simple", () => {
    expect(countWords("bonjour à tous et merci")).toBe(5);
  });
  it("espaces multiples et sauts de ligne comptent comme un seul séparateur", () => {
    expect(countWords("bonjour   à\ntous")).toBe(3);
  });
});
