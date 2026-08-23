import { describe, it, expect } from "vitest";
import { cumulerSegments, planPrevu, comparer, etatSlide, SEUILS_REPETITION } from "../../lib/repetition";
import type { Deck } from "../../lib/slides/types";
import type { Pitch } from "../../lib/pitch";

const deck: Deck = {
  nomFichier: "soutenance.pdf",
  slides: [1, 2, 3, 4].map((n) => ({ numero: n, titre: `Slide ${n}`, texte: `Contenu ${n}`, motsCount: 2 })),
};

const pitch: Pitch = {
  accroche: "…",
  slides: [
    { numero: 1, messageCle: "", texte: "", transition: "", secondes: 60 },
    { numero: 2, messageCle: "", texte: "", transition: "", secondes: 120 },
    { numero: 3, messageCle: "", texte: "", transition: "", secondes: 90 },
    { numero: 4, messageCle: "", texte: "", transition: "", secondes: 30 },
  ],
  conclusion: "…",
  conseils: [],
};

describe("cumulerSegments", () => {
  it("additionne les passages sur une même diapositive, trié par numéro", () => {
    const r = cumulerSegments([
      { numero: 2, debutMs: 0, finMs: 10_000 },
      { numero: 1, debutMs: 10_000, finMs: 15_000 },
      { numero: 2, debutMs: 15_000, finMs: 20_000 },
      { numero: 3, debutMs: 20_000, finMs: 19_000 }, // segment incohérent : compte 0, ne casse rien
    ]);
    expect(r).toEqual([
      { numero: 1, dureeMs: 5_000 },
      { numero: 2, dureeMs: 15_000 },
      { numero: 3, dureeMs: 0 },
    ]);
  });
});

describe("planPrevu", () => {
  it("prend le minutage du pitch quand il couvre toutes les diapositives", () => {
    const p = planPrevu(deck, pitch, 300_000);
    expect(p.source).toBe("pitch");
    expect(p.prevu[1]).toEqual({ numero: 2, dureeMs: 120_000 });
  });

  it("sinon répartit uniformément — et le dit", () => {
    const p = planPrevu(deck, null, 300_000);
    expect(p.source).toBe("uniforme");
    expect(p.prevu.map((x) => x.dureeMs)).toEqual([75_000, 75_000, 75_000, 75_000]);
    const incomplet = { ...pitch, slides: pitch.slides.slice(0, 2) };
    expect(planPrevu(deck, incomplet, 300_000).source).toBe("uniforme");
  });
});

describe("comparer", () => {
  const prevu = planPrevu(deck, pitch, 300_000).prevu;

  it("classe chaque diapositive et nomme la non vue et le pire dépassement", () => {
    const c = comparer(deck, prevu, [
      { numero: 1, dureeMs: 66_000 }, // +10 % → bon
      { numero: 2, dureeMs: 200_000 }, // +67 % → alerte
      { numero: 3, dureeMs: 120_000 }, // +33 % → attention
    ]);
    expect(c.lignes.map((l) => l.niveau)).toEqual(["bon", "alerte", "attention", "non-vue"]);
    expect(c.nonVues).toEqual([4]);
    expect(c.pireDepassement?.numero).toBe(2);
    expect(c.totalPrevuMs).toBe(300_000);
    expect(c.totalReelMs).toBe(386_000);
    expect(c.resume).toContain("La diapositive 4 n'a pas été montrée.");
    expect(c.resume).toContain("La diapositive 2 a pris 3 min 20 s pour 2 min 00 s prévues");
    expect(c.resume).toContain("1/4 diapositives dans leur temps.");
  });

  it("félicite sans inventer quand tout est dans les temps", () => {
    const c = comparer(deck, prevu, prevu.map((p) => ({ ...p, dureeMs: Math.round(p.dureeMs * 1.1) })));
    expect(c.lignes.every((l) => l.niveau === "bon")).toBe(true);
    expect(c.pireDepassement).toBeNull();
    expect(c.resume).toMatch(/^Chaque diapositive est dans son temps/);
  });

  it("trop court compte aussi comme un écart", () => {
    const c = comparer(deck, prevu, prevu.map((p) => ({ ...p, dureeMs: Math.round(p.dureeMs * 0.4) })));
    expect(c.lignes.every((l) => l.niveau === "alerte")).toBe(true);
    expect(c.pireDepassement).toBeNull(); // aucun dépassement, seulement des raccourcis
    expect(c.resume).toContain("4 diapositives ont été expédiées bien plus vite que prévu (1, 2, 3, 4)");
    expect(c.resume).not.toContain("Aucun gros dérapage");
  });

  it("une seule diapositive expédiée est nommée au singulier", () => {
    const reel = prevu.map((p) => (p.numero === 3 ? { ...p, dureeMs: 10_000 } : p));
    expect(comparer(deck, prevu, reel).resume).toMatch(/^La diapositive 3 a été expédiée bien plus vite que prévu/);
  });
});

describe("etatSlide", () => {
  it("vert, puis orange à 90 %, rouge au-delà de la tolérance", () => {
    expect(etatSlide(50_000, 60_000)).toBe("dans-les-temps");
    expect(etatSlide(55_000, 60_000)).toBe("proche");
    expect(etatSlide(60_000 * (1 + SEUILS_REPETITION.bon) + 1, 60_000)).toBe("depasse");
    expect(etatSlide(10_000, 0)).toBe("dans-les-temps");
  });
});
