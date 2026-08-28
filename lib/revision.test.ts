import { describe, it, expect } from "vitest";
import { construireRevision } from "./revision";

function stockage(entrees: Record<string, unknown>) {
  const m = new Map(Object.entries(entrees).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
  };
}

const appel = (date: string, dialogue: unknown[], momentsManques: unknown[] = [], bienFait: unknown[] = []) => ({
  mode: "soutenance",
  date,
  dialogue,
  debrief: { diagnostic: "", bienFait, momentsManques, planAction: [], questionsPosees: [] },
});

describe("tout revoir — l'historique rangé par question", () => {
  it("est vide sans historique, sans planter", () => {
    const r = construireRevision(stockage({}));
    expect(r.nbSeances).toBe(0);
    expect(r.aRetravailler).toEqual([]);
    expect(construireRevision({ getItem: () => null, setItem: () => {} }).nbSeances).toBe(0);
  });

  it("range les ratées avec la bonne réponse, la matière de révision", () => {
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-25T10:00:00Z", [], [
          { question: "Sur quel jeu de test avez-vous mesuré ?", ceQueTuAsDit: "euh", mieux: "12 000 sessions tenues à l'écart" },
        ]),
      }),
    );
    expect(r.aRetravailler).toHaveLength(1);
    expect(r.aRetravailler[0]!.mieux).toContain("12 000");
    expect(r.aRetravailler[0]!.tuAsDit).toBe("euh");
  });

  it("une question ratée prime sur la même question simplement posée", () => {
    const q = "Comment le seuil a-t-il été choisi ?";
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-20T10:00:00Z", [{ role: "assistant", content: q }], [
          { question: q, ceQueTuAsDit: "…", mieux: "un compromis mesuré" },
        ]),
      }),
    );
    expect(r.aRetravailler).toHaveLength(1);
    expect(r.posees).toHaveLength(0);
  });

  it("regroupe deux formulations identiques à la ponctuation près", () => {
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-20T10:00:00Z", [{ role: "assistant", content: "Quel était votre rôle exact ?" }]),
        "sc.ia.v1:appel:b": appel("2026-08-24T10:00:00Z", [{ role: "assistant", content: "quel était votre rôle exact" }]),
      }),
    );
    expect(r.posees).toHaveLength(1);
    // Et garde la plus récente.
    expect(r.posees[0]!.date).toBe("2026-08-24T10:00:00Z");
  });

  it("les plus récentes d'abord — on révise ce qui est frais", () => {
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-20T10:00:00Z", [{ role: "assistant", content: "Première question posée ici ?" }]),
        "sc.ia.v1:appel:b": appel("2026-08-24T10:00:00Z", [{ role: "assistant", content: "Seconde question posée là ?" }]),
      }),
    );
    expect(r.posees[0]!.question).toContain("Seconde");
    expect(r.nbSeances).toBe(2);
  });

  it("compte les soutenances blanches et ignore le corrompu", () => {
    const st = stockage({
      "sc.ia.v1:blanche:x": { faitLe: "2026-08-23T10:00:00Z", reponses: [{ question: { question: "Pourquoi ce choix d'architecture ?" }, transcript: "parce que…" }] },
      "sc.ia.v1:appel:questions-posees": ["ne doit pas compter comme séance"],
    });
    st.setItem("sc.ia.v1:appel:casse", "{pas du json");
    const r = construireRevision(st);
    expect(r.nbSeances).toBe(1);
    expect(r.posees[0]!.question).toContain("architecture");
    expect(r.posees[0]!.tuAsDit).toContain("parce que");
  });
});

/**
 * Vu sur l'historique réel de l'utilisateur : le jury avait préfixé sa
 * question d'ouverture — « Alors, Zakaria : qu'est-ce que tu as fait
 * toi-même… » — et la même question, ratée au débrief sans le préfixe,
 * apparaissait en double. Deux clés dont l'une contient l'autre désignent
 * la même question.
 */
describe("le rapprochement des questions préfixées", () => {
  it("range la version préfixée avec la version ratée, sans doublon", () => {
    const q = "Qu'est-ce que tu as fait toi-même pour fiabiliser Coach IA, sans compter le reste ?";
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-27T10:00:00Z", [{ role: "assistant", content: `Alors, Zakaria : ${q}` }], [
          { question: q, ceQueTuAsDit: "…", mieux: "énumérer une action précise" },
        ]),
      }),
    );
    expect(r.aRetravailler).toHaveLength(1);
    expect(r.posees).toHaveLength(0);
  });

  it("ne rapproche pas deux questions courtes par accident", () => {
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-27T10:00:00Z", [
          { role: "assistant", content: "Pourquoi ce choix ?" },
          { role: "assistant", content: "Et pourquoi ce choix précis de seuil, dans votre contexte ?" },
        ]),
      }),
    );
    expect(r.posees).toHaveLength(2);
  });

  it("rapproche aussi une question LONGUE préfixée — le cas réel exact", () => {
    // La clé tronquée à 120 signes échouait ici : le préfixe décale tout.
    const q =
      "Qu'est-ce que tu as fait toi-même pour fiabiliser Coach IA, sans compter ce que j'ai pu relire ou corriger derrière toi, et quelles preuves concrètes peux-tu en donner au jury aujourd'hui ?";
    const r = construireRevision(
      stockage({
        "sc.ia.v1:appel:a": appel("2026-08-27T10:00:00Z", [{ role: "assistant", content: `Alors, Zakaria : ${q}` }], [
          { question: q, ceQueTuAsDit: "…", mieux: "énumérer une action précise" },
        ]),
      }),
    );
    expect(r.aRetravailler).toHaveLength(1);
    expect(r.posees).toHaveLength(0);
  });
});
