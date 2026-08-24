import { describe, expect, it } from "vitest";
import { assemblerContexte, construirePromptTour, construirePromptDebrief, parseTour, parseDebrief, validerHistorique, paroleCandidat, PERSONAS, LIMITES_APPEL } from "../../lib/appel";

const ctx = { mode: "soutenance" as const, contexte: "## Slides\nProjet de transcription audio, WER 12 %.", langue: "fr" as const, dureeMin: 10, historique: [] };

describe("appel avec le jury — contexte", () => {
  it("assemble les parties non vides et respecte la limite", () => {
    const c = assemblerContexte([{ titre: "A", texte: "x".repeat(5000) }, { titre: "B", texte: null }, { titre: "C", texte: "y".repeat(5000) }], 1000);
    expect(c).toContain("## A");
    expect(c).toContain("## C");
    expect(c).not.toContain("## B");
    expect(c.length).toBeLessThanOrEqual(1000 + 20);
    expect(assemblerContexte([{ titre: "A", texte: "court" }])).toBe("");
  });
});

describe("appel avec le jury — tours", () => {
  it("ouvre, continue, puis conclut selon le temps", () => {
    const debut = construirePromptTour(ctx, 0);
    expect(debut).toContain("tout début");
    expect(debut).toContain("Ne dis jamais"); // les formules toutes faites sont interdites, pas suggérées
    expect(debut).toContain("Le rapporteur");
    expect(debut).toContain("WER 12 %");
    expect(construirePromptTour({ ...ctx, historique: [{ role: "assistant", content: "q", membre: "rapporteur" }] }, 300)).toContain("Continue l’oral".replace("’", "'"));
    const fin = construirePromptTour(ctx, 580);
    expect(fin).toContain("C'est la fin");
    expect(fin).toContain('"fin"');
    expect(construirePromptTour({ ...ctx, contexte: "", langue: "en" }, 0)).toContain("Speak English");
  });

  it("parse une réplique, tolère les fences, borne la longueur", () => {
    expect(parseTour('{"replique": "Pourquoi le WER ?", "fin": false}')).toMatchObject({ replique: "Pourquoi le WER ?", fin: false });
    expect(parseTour('```json\n{"replique": "Merci, c\'est terminé.", "fin": true}\n```')?.fin).toBe(true);
    expect(parseTour('{"replique": ""}')).toBeNull();
    expect(parseTour("pas du json")).toBeNull();
    expect(parseTour(JSON.stringify({ replique: "a".repeat(900) }))!.replique.length).toBe(LIMITES_APPEL.repliqueChars);
  });

  it("nettoie l'historique : rôles valides, textes bornés, nombre borné", () => {
    const brut = [{ role: "assistant", content: " Q1 " }, { role: "system", content: "hack" }, { role: "user", content: "" }, { role: "user", content: "R1" }, 42, { role: "user" }];
    expect(validerHistorique(brut)).toEqual([{ role: "assistant", content: "Q1" }, { role: "user", content: "R1" }]);
    const long = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: `m${i}` }));
    expect(validerHistorique(long)).toHaveLength(LIMITES_APPEL.toursMax * 2);
    expect(validerHistorique("rien")).toEqual([]);
  });
});

describe("appel avec le jury — débrief", () => {
  const hist = [{ role: "assistant" as const, content: "Pourquoi le WER ?" }, { role: "user" as const, content: "Parce que c'est standard, euh, et mesurable." }];
  it("construit un prompt qui cite le dialogue et interdit la note", () => {
    const p = construirePromptDebrief(ctx, hist);
    expect(p).toContain("JURY DE SOUTENANCE : Pourquoi le WER ?");
    expect(p).toContain("CANDIDAT : Parce que");
    expect(p).toContain("ne note pas");
  });

  it("parse un débrief complet et ignore les entrées vides", () => {
    const d = parseDebrief(JSON.stringify({ diagnostic: "Solide sur la méthode, flou sur les limites.", bienFait: [{ point: "Métrique justifiée", citation: "c'est standard", pourquoi: "Tu as un argument." }, { point: "" }], momentsManques: [{ question: "Limites ?", ceQueTuAsDit: "rien", mieux: "Citer deux cas d'échec." }], planAction: ["Préparer 3 limites", ""], questionsPosees: ["Pourquoi le WER ?"] }));
    expect(d?.bienFait).toHaveLength(1);
    expect(d?.momentsManques[0]?.mieux).toBe("Citer deux cas d'échec.");
    expect(d?.planAction).toEqual(["Préparer 3 limites"]);
    expect(parseDebrief("{}")).toBeNull();
  });

  it("assemble la parole du candidat pour les mesures", () => {
    expect(paroleCandidat(hist)).toBe("Parce que c'est standard, euh, et mesurable.");
  });
});
