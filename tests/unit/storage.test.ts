import { describe, it, expect } from "vitest";
import {
  listSessions,
  saveSession,
  removeSession,
  countWords,
  exportSessions,
  importSessions,
} from "../../lib/storage";
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

describe("export / import — les données doivent pouvoir sortir du navigateur", () => {
  it("l'export produit une enveloppe versionnée contenant les sessions", () => {
    const json = exportSessions([session({ id: "a" })], "2026-08-22T12:00:00.000Z");
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe("soutenance-coach/sessions");
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe("2026-08-22T12:00:00.000Z");
    expect(parsed.sessions).toHaveLength(1);
  });

  it("aller-retour export → import : les sessions sont restituées à l'identique", () => {
    const original = [session({ id: "a" }), session({ id: "b", startedAt: "2026-08-20T09:00:00.000Z" })];
    const json = exportSessions(original, "2026-08-22T12:00:00.000Z");
    const cible = memoryStorage();
    const outcome = importSessions(cible, json);
    expect(outcome.added).toBe(2);
    expect(listSessions(cible).map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("un import ne détruit jamais l'existant : les ids connus sont ignorés", () => {
    const s = memoryStorage();
    saveSession(s, session({ id: "a", transcript: "version locale" }));
    const json = exportSessions(
      [session({ id: "a", transcript: "version importée" }), session({ id: "neuve" })],
      "2026-08-22T12:00:00.000Z",
    );
    const outcome = importSessions(s, json);
    expect(outcome).toMatchObject({ added: 1, skipped: 1, invalid: 0 });
    expect(listSessions(s).find((x) => x.id === "a")?.transcript).toBe("version locale");
  });

  it("un tableau nu (sans enveloppe) est accepté", () => {
    const s = memoryStorage();
    const outcome = importSessions(s, JSON.stringify([session({ id: "a" })]));
    expect(outcome.added).toBe(1);
  });

  it("les entrées mal formées sont comptées et ignorées, les bonnes passent", () => {
    const s = memoryStorage();
    const outcome = importSessions(
      s,
      JSON.stringify({ sessions: [session({ id: "ok" }), { id: "cassée" }, 42] }),
    );
    expect(outcome).toMatchObject({ added: 1, invalid: 2 });
    expect(listSessions(s).map((x) => x.id)).toEqual(["ok"]);
  });

  it("un fichier illisible → message d'erreur, stockage intact", () => {
    const s = memoryStorage();
    saveSession(s, session({ id: "a" }));
    const outcome = importSessions(s, "ceci n'est pas du json");
    expect(outcome.error).toContain("illisible");
    expect(listSessions(s)).toHaveLength(1);
  });

  it("un JSON valide mais d'un autre format → message explicite", () => {
    const outcome = importSessions(memoryStorage(), JSON.stringify({ autre: "chose" }));
    expect(outcome.error).toContain("Format non reconnu");
  });

  it("les champs optionnels (confiance, durée visée) survivent à l'aller-retour", () => {
    const avec = { ...session({ id: "a" }), confidence: 0.91, targetDurationMs: 600_000 };
    const s = memoryStorage();
    importSessions(s, exportSessions([avec], "2026-08-22T12:00:00.000Z"));
    const restaurée = listSessions(s)[0];
    expect(restaurée.confidence).toBe(0.91);
    expect(restaurée.targetDurationMs).toBe(600_000);
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
