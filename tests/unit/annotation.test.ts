import { describe, it, expect } from "vitest";
import { annoterTranscription, resumeAnnotation } from "../../lib/scoring/annotation";
import { countFillers } from "../../lib/scoring/fillers";

describe("annoterTranscription", () => {
  it("conserve le texte à l'identique une fois recollé", () => {
    const t = "Euh bonjour, du coup je vais vous présenter, en fait, mon projet.  Voilà.";
    expect(annoterTranscription(t).map((s) => s.texte).join("")).toBe(t);
  });

  it("marque les mots simples et les expressions multi-mots, avec la forme canonique", () => {
    const seg = annoterTranscription("Heu bonjour, du coup je présente. Voilà !");
    const beq = seg.filter((s) => s.type === "bequille").map((s) => [s.texte, s.canonique]);
    expect(beq).toEqual([
      ["Heu", "euh"],
      ["du coup", "du coup"],
      ["Voilà", "voilà"],
    ]);
  });

  it("compte exactement comme le comptage officiel", () => {
    const t = "Donc euh, du coup, en fait je pense que, bref, c'est euh bien. Du coup voilà, genre, et voilà.";
    const officiel = countFillers(t).reduce((a, f) => a + f.count, 0);
    const annot = resumeAnnotation(annoterTranscription(t));
    expect(annot.total).toBe(officiel);
    expect(annot.parCanonique[0].canonique).toBe("du coup");
  });

  it("ne marque rien dans une phrase propre", () => {
    const seg = annoterTranscription("Je vais vous présenter mon projet en trois parties.");
    expect(seg.every((s) => s.type === "normal")).toBe(true);
    expect(resumeAnnotation(seg).total).toBe(0);
  });
});
