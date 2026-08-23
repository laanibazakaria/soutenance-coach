import { describe, it, expect } from "vitest";
import { construirePromptExemple, parseExemple, cleExemple } from "../../lib/jury/exemple";

describe("exemple de réponse", () => {
  it("la consigne interdit d'inventer, impose le format oral et la persona", () => {
    const p = construirePromptExemple({ question: "Pourquoi le WER ?", persona: "Jury de soutenance", contexte: "Slide 3 : WER 8,2 → 6,9", reponseEtudiant: "Euh…", langue: "fr" });
    expect(p).toContain("jury de soutenance");
    expect(p).toContain("N'invente AUCUN fait");
    expect(p).toContain("[à compléter");
    expect(p).toContain("WER 8,2");
    expect(p).toContain("CE QUE LE CANDIDAT A RÉPONDU");
    expect(p).not.toContain("LANGUE : le candidat");
    expect(construirePromptExemple({ question: "q", persona: "Recruteur", langue: "en" })).toContain("EN ANGLAIS");
    expect(construirePromptExemple({ question: "q", persona: "Recruteur" })).toContain("DOSSIER : inconnu");
  });

  it("lit un exemple valide, refuse un exemple trop court ou sans raison", () => {
    const ok = parseExemple(JSON.stringify({ reponse: "Nous avons retenu le WER parce que c'est la métrique standard de la transcription : sur nos douze fichiers, il passe de 8,2 à 6,9 %.", pourquoi: ["Tu réponds directement.", "Tu cites ton chiffre."], suppositions: [] }))!;
    expect(ok.pourquoi).toHaveLength(2);
    expect(ok.suppositions).toEqual([]);
    expect(parseExemple(JSON.stringify({ reponse: "court", pourquoi: ["x"] }))).toBeNull();
    expect(parseExemple(JSON.stringify({ reponse: "a".repeat(60), pourquoi: [] }))).toBeNull();
    expect(parseExemple("pas du json")).toBeNull();
  });

  it("clé de cache stable, dépendante de la question et du contexte", () => {
    expect(cleExemple("q", "c")).toBe(cleExemple("q", "c"));
    expect(cleExemple("q", "c")).not.toBe(cleExemple("q", "d"));
    expect(cleExemple("q")).toMatch(/^exemple:/);
  });
});
