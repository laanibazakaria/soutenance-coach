import { describe, it, expect } from "vitest";
import { construirePromptRapporteur, parseQuestionsRapporteur, extraitPourModele, estRapport, empreinteRapport, LIMITES_RAPPORT } from "../../lib/rapport";

describe("rapport", () => {
  it("garde le début et la fin d'un long document, en le disant", () => {
    const t = "D".repeat(40_000) + "M".repeat(40_000) + "F".repeat(40_000);
    const e = extraitPourModele(t, 10_000);
    expect(e.length).toBeLessThan(10_200);
    expect(e.startsWith("DDDD")).toBe(true);
    expect(e.endsWith("FFFF")).toBe(true);
    expect(e).toContain("caractères non transmis");
    expect(extraitPourModele("court")).toBe("court");
  });

  it("la consigne est celle d'un rapporteur : spécifique, faiblesses, justification, sans note", () => {
    const p = construirePromptRapporteur({ nomFichier: "memoire.pdf", pages: 48, texte: "3.2 Méthode : validation A/B sur 12 fichiers." });
    expect(p).toContain("RAPPORTEUR");
    expect(p).toContain("48 pages");
    expect(p).toContain("validation A/B sur 12 fichiers");
    expect(p).toContain("trois questions pointent une faiblesse");
    expect(p).toContain("Aucune note");
  });

  it("lit les questions, rattache la section, refuse le trop court", () => {
    const q = parseQuestionsRapporteur(JSON.stringify([
      { question: "Page 23, vous concluez à une amélioration sans intervalle de confiance : comment l'établissez-vous ?", pourquoi: "La rigueur statistique.", categorie: "resultats", section: "4.1" },
      { question: "Pourquoi 12 fichiers audio et pas davantage ?", pourquoi: "La taille de l'échantillon.", categorie: "methode", section: "" },
      { question: "Vous n'abordez jamais le coût : était-ce hors périmètre ?", pourquoi: "Une limite non discutée.", categorie: "limites" },
      { question: "court", pourquoi: "x" },
    ]))!;
    expect(q).toHaveLength(3);
    expect(q[0].pourquoi).toContain("rapporteur (§ 4.1)");
    expect(q[1].pourquoi.endsWith("— rapporteur")).toBe(true);
    expect(q[2].categorie).toBe("limites");
    expect(q.every((x) => x.id.startsWith("rapport-"))).toBe(true);
    expect(parseQuestionsRapporteur(JSON.stringify([{ question: "Une seule question valable ?", pourquoi: "x" }]))).toBeNull();
  });

  it("valide la forme et fournit une empreinte stable", () => {
    expect(estRapport({ nomFichier: "m.pdf", pages: 10, texte: "x", misAJourLe: "2026-08-24T00:00:00.000Z" })).toBe(true);
    expect(estRapport({ nomFichier: "m.pdf" })).toBe(false);
    expect(empreinteRapport("abc")).toBe(empreinteRapport("abc"));
    expect(empreinteRapport("abc")).not.toBe(empreinteRapport("abd"));
    expect(LIMITES_RAPPORT.envoiChars).toBeLessThanOrEqual(LIMITES_RAPPORT.texteChars);
  });
});
