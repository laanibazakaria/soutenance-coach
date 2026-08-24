import { describe, expect, it } from "vitest";
import { decouper, similarite, retrouver, contextePassages, LIMITES_MEMOIRE, type PassageVectorise } from "../../lib/memoire";

const paragraphe = (mot: string, n: number) => Array.from({ length: n }, () => mot).join(" ");

describe("mémoire — découpage en passages", () => {
  it("garde un texte court en un seul passage", () => {
    const p = decouper("Le problème est la latence de transcription. Nous mesurons le WER.");
    expect(p).toHaveLength(1);
    expect(p[0]!.numero).toBe(1);
    expect(p[0]!.section).toBeNull();
  });

  it("attache le titre de section au-dessus de chaque passage", () => {
    const texte = ["1. Introduction", paragraphe("contexte", 30), "2. Méthode", paragraphe("protocole", 30)].join("\n");
    const p = decouper(texte);
    expect(p).toHaveLength(2);
    expect(p[0]!.section).toBe("1. Introduction");
    expect(p[1]!.section).toBe("2. Méthode");
    expect(p[1]!.texte).toContain("protocole");
  });

  it("reconnaît aussi les titres en majuscules et les chapitres", () => {
    const p = decouper(["CONCLUSION GENERALE", paragraphe("bilan", 30), "Chapitre 3", paragraphe("suite", 30)].join("\n"));
    expect(p.map((x) => x.section)).toEqual(["CONCLUSION GENERALE", "Chapitre 3"]);
  });

  it("coupe les longs textes à la fin d'une phrase", () => {
    const phrase = "Nous avons mesuré le taux d'erreur sur douze fichiers audio distincts. ";
    const p = decouper(phrase.repeat(60));
    expect(p.length).toBeGreaterThan(1);
    for (const bloc of p) {
      expect(bloc.texte.length).toBeLessThanOrEqual(LIMITES_MEMOIRE.max);
      expect(bloc.texte.trim().endsWith(".")).toBe(true);
    }
    expect(p.map((x) => x.numero)).toEqual(p.map((_, i) => i + 1));
  });

  it("coupe quand même un pavé sans ponctuation", () => {
    const p = decouper(paragraphe("mot", 2000));
    expect(p.length).toBeGreaterThan(1);
    expect(p.every((x) => x.texte.length <= LIMITES_MEMOIRE.max)).toBe(true);
  });

  it("ne dépasse jamais le plafond de passages", () => {
    const p = decouper("Une phrase de test assez longue pour compter. ".repeat(4000));
    expect(p.length).toBeLessThanOrEqual(LIMITES_MEMOIRE.passagesMax);
  });

  it("ignore un document vide", () => {
    expect(decouper("")).toEqual([]);
    expect(decouper("\n\n   \n")).toEqual([]);
  });
});

describe("mémoire — retrouver les bons passages", () => {
  const passages: PassageVectorise[] = [
    { numero: 1, section: "Introduction", texte: "Le problème du bruit dans les appels.", vecteur: [1, 0, 0] },
    { numero: 2, section: "Méthode", texte: "Le WER est mesuré sur douze fichiers.", vecteur: [0, 1, 0] },
    { numero: 3, section: "Limites", texte: "L'échantillon reste petit.", vecteur: [0, 0.9, 0.1] },
  ];

  it("mesure la similarité cosinus", () => {
    expect(similarite([1, 0], [1, 0])).toBeCloseTo(1);
    expect(similarite([1, 0], [0, 1])).toBeCloseTo(0);
    expect(similarite([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(similarite([], [1])).toBe(0);
    expect(similarite([0, 0], [1, 1])).toBe(0);
  });

  it("classe les passages du plus proche au plus lointain", () => {
    const t = retrouver([0, 1, 0], passages, 2);
    expect(t.map((x) => x.numero)).toEqual([2, 3]);
    expect(t[0]!.proximite).toBeGreaterThan(t[1]!.proximite);
  });

  it("écarte les passages sans rapport", () => {
    const t = retrouver([0, 0, -1], passages, 3);
    expect(t.every((x) => x.proximite > 0)).toBe(true);
  });

  it("compose un contexte citable, ou rien", () => {
    const bloc = contextePassages(retrouver([0, 1, 0], passages, 2))!;
    expect(bloc).toContain("[Passage 2 — Méthode]");
    expect(bloc).toContain("douze fichiers");
    expect(bloc).toContain("n'invente rien");
    expect(contextePassages([])).toBeNull();
  });
});
