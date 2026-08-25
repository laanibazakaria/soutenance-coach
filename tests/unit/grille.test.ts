import { describe, expect, it } from "vitest";
import { GRILLES, normaliser, mention, niveauCritere, construirePrompt, parseReponse, RATIO_MIN, type IdOral } from "../../lib/grille";

const ORAUX: IdOral[] = ["soutenance", "entretien", "pitch", "concours"];

/** Réponse plausible du modèle : une note par critère. */
const reponse = (notes: Array<number | null>, extra: Record<string, unknown> = {}) => ({
  criteres: notes.map((note, i) => ({ id: i + 1, note, constat: `constat ${i + 1}`, citation: `citation ${i + 1}`, conseil: `conseil ${i + 1}` })),
  ...extra,
});

describe("grille — les quatre oraux", () => {
  it("a des critères pondérés aux identifiants continus, par oral", () => {
    for (const id of ORAUX) {
      const g = GRILLES[id];
      // La soutenance en a treize : « Part personnelle » a été ajoutée parce que
      // le jury la demande et que la grille ne la notait nulle part.
      expect(g.criteres.length).toBe(id === "soutenance" ? 13 : 12);
      expect(g.criteres.map((c) => c.id)).toEqual(g.criteres.map((_, i) => i + 1));
      expect(g.criteres.every((c) => c.poids >= 1 && c.poids <= 2)).toBe(true);
      expect(g.criteres.every((c) => c.titre.length > 3 && c.regarde.length > 20)).toBe(true);
    }
  });

  it("décrit la grille et interdit toute moyenne dans la consigne", () => {
    const p = construirePrompt({ oral: "soutenance", echange: "Jury : … Candidat : …" });
    expect(p).toContain("1. Accroche et cadrage");
    expect(p).toContain("12. Conclusion et ouverture");
    expect(p).toContain("Ne calcule AUCUNE moyenne");
    expect(p).toContain('"note": null');
  });

  it("place le dossier et les mesures quand on les a", () => {
    const p = construirePrompt({ oral: "entretien", echange: "…", contexte: "CV : ingénieur IA", mesures: "débit 180 mots/min" });
    expect(p).toContain("CV : ingénieur IA");
    expect(p).toContain("débit 180 mots/min");
    expect(p).toContain("ne les recalcule pas");
  });
});

describe("grille — la note est calculée par le code", () => {
  it("recalcule la moyenne pondérée et ignore celle du modèle", () => {
    // Toutes les notes à 6 : la moyenne pondérée vaut 6, quoi que dise le modèle.
    const e = normaliser(reponse(Array(12).fill(6), { note_globale: 9.9, total: 42 }), GRILLES.soutenance);
    expect(e.note).toBe(6);
    expect(e.poidsRetenu).toBe(18.5);
  });

  it("pondère vraiment : un critère lourd pèse plus qu'un léger", () => {
    // Sur le seul volet « questions », deux lourds à 10 et deux légers à 0.
    const notes: Array<number | null> = Array(13).fill(null);
    notes[1] = 10; // Problématique, poids 2
    notes[3] = 10; // Méthode justifiée, poids 2
    notes[4] = 10; // Résultats chiffrés, poids 2
    notes[5] = 0; // Limites assumées, poids 1.5
    notes[6] = 0; // Réponses aux questions, poids 2
    notes[7] = 10; // Maîtrise des chiffres, poids 1.5
    notes[9] = 0; // Clarté, poids 1.5
    notes[12] = 10; // Part personnelle, poids 2
    const e = normaliser(reponse(notes), GRILLES.soutenance, ["questions"]);
    expect(e.insuffisant).toBe(false);
    // (2+2+2+1.5+2)×10 … recalculé à la main : 95 / 14.5
    expect(e.note).toBeCloseTo(6.6, 1);
    // Les critères d'exposé ne sont même pas dans la liste : ils n'ont pas eu lieu.
    expect(e.criteres.map((c) => c.id)).not.toContain(1);
  });

  it("borne les notes aberrantes du modèle au lieu de les propager", () => {
    const e = normaliser(reponse([15, -4, ...Array(10).fill(5)]), GRILLES.soutenance);
    expect(e.criteres[0]!.note).toBe(10);
    expect(e.criteres[1]!.note).toBe(0);
    expect(e.note).not.toBeNull();
    expect(e.note!).toBeGreaterThanOrEqual(0);
    expect(e.note!).toBeLessThanOrEqual(10);
  });

  it("refuse d'afficher une note quand l'échange était trop court", () => {
    const notes: Array<number | null> = Array(12).fill(null);
    notes[0] = 8; // poids 1.5 seulement
    const e = normaliser(reponse(notes), GRILLES.soutenance);
    expect(e.insuffisant).toBe(true);
    expect(e.note).toBeNull();
    const possible = GRILLES.soutenance.criteres.reduce((t, c) => t + c.poids, 0);
    expect(e.poidsRetenu).toBeLessThan(RATIO_MIN * possible);
  });

  it("ne renvoie jamais 0 par défaut quand rien n'est évaluable", () => {
    const e = normaliser(reponse(Array(12).fill(null)), GRILLES.pitch);
    expect(e.note).toBeNull();
    expect(e.poidsRetenu).toBe(0);
    expect(e.criteres).toHaveLength(12);
  });
});

describe("grille — robustesse face au modèle", () => {
  it("garde les douze critères même si le modèle en oublie", () => {
    const e = normaliser({ criteres: [{ id: 3, note: 7, constat: "ok", citation: "", conseil: "c" }] }, GRILLES.concours);
    expect(e.criteres).toHaveLength(12);
    expect(e.criteres[2]!.note).toBe(7);
    expect(e.criteres[0]!.note).toBeNull();
  });

  it("survit à des identifiants en chaîne, en désordre, ou en trop", () => {
    const e = normaliser({ criteres: [{ id: "5", note: 9, constat: "a", citation: "b", conseil: "c" }, { id: 99, note: 10 }, { id: 1, note: 4 }] }, GRILLES.entretien);
    expect(e.criteres[4]!.note).toBe(9);
    expect(e.criteres[0]!.note).toBe(4);
    expect(e.criteres).toHaveLength(12);
  });

  it("survit à n'importe quelle bouillie", () => {
    for (const brut of [null, undefined, "texte", 42, {}, { criteres: "non" }, { criteres: [null] }]) {
      const e = normaliser(brut, GRILLES.soutenance);
      expect(e.criteres).toHaveLength(13);
      expect(e.note).toBeNull();
    }
  });

  it("tronque les textes trop longs sans planter", () => {
    const e = normaliser({ criteres: [{ id: 1, note: 5, constat: "x".repeat(2000), citation: "y".repeat(2000), conseil: "z".repeat(2000) }] }, GRILLES.soutenance);
    expect(e.criteres[0]!.constat.length).toBe(400);
    expect(e.criteres[0]!.citation.length).toBe(300);
  });

  it("lit le JSON même entouré de bavardage", () => {
    expect(parseReponse('Voici :\n```json\n{"criteres":[{"id":1,"note":7}]}\n```\nVoilà.')).toEqual({ criteres: [{ id: 1, note: 7 }] });
    expect(parseReponse("pas de json")).toBeNull();
    expect(parseReponse("{cassé")).toBeNull();
  });
});

describe("grille — ce qu'on montre à l'étudiant", () => {
  it("classe les priorités par points perdus, pas par note brute", () => {
    const notes: Array<number | null> = Array(12).fill(9);
    notes[8] = 4; // Gestion du temps, poids 1 → perd 6
    notes[3] = 5; // Méthode justifiée, poids 2 → perd 10
    const e = normaliser(reponse(notes), GRILLES.soutenance);
    expect(e.prioritaires[0]!.titre).toBe("Méthode justifiée");
    expect(e.prioritaires[1]!.titre).toBe("Gestion du temps");
    expect(e.prioritaires.length).toBeLessThanOrEqual(3);
  });

  it("sépare ce qui est acquis de ce qui reste à travailler", () => {
    const notes: Array<number | null> = Array(12).fill(3);
    notes[0] = 9;
    notes[1] = 8;
    const e = normaliser(reponse(notes), GRILLES.soutenance);
    expect(e.acquis.map((c) => c.titre)).toEqual(["Accroche et cadrage", "Problématique explicite"]);
    expect(e.prioritaires.every((c) => c.note! < 8)).toBe(true);
  });

  it("donne une mention qui parle, et jamais un jugement sur la personne", () => {
    expect(mention(null)).toBe("Pas encore mesurable");
    expect(mention(9)).toBe("Prêt");
    expect(mention(7.2)).toBe("Presque prêt");
    expect(mention(6)).toBe("En chemin");
    expect(mention(4.5)).toBe("Des bases, du travail");
    expect(mention(2)).toBe("À reprendre");
    for (const n of [null, 0, 5, 10]) expect(mention(n)).not.toMatch(/nul|mauvais|médiocre/i);
  });

  it("colore les critères par niveau", () => {
    expect(niveauCritere(9)).toBe("bon");
    expect(niveauCritere(6)).toBe("attention");
    expect(niveauCritere(3)).toBe("alerte");
    expect(niveauCritere(null)).toBe("absent");
  });
});
