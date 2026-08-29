import { describe, expect, it } from "vitest";
import { decouper, contientParole } from "../../lib/decoupe-voix";

// La découpe qui suit la voix : chaque cas est une fenêtre de niveaux RMS
// (un point par 100 ms). L'ancienne coupe aveugle toutes les 3 s tranchait
// en plein mot — mots manquants et déformés aux frontières.
const parole = (n: number) => Array.from({ length: n }, () => 0.05);
const silence = (n: number) => Array.from({ length: n }, () => 0.002);

describe("decouper", () => {
  it("ne coupe pas pendant que la personne parle", () => {
    expect(decouper(parole(30))).toBe("continuer");
  });

  it("coupe à la pause : 2 s de parole puis 600 ms de calme", () => {
    expect(decouper([...parole(20), ...silence(6)])).toBe("couper");
  });

  it("ne prend pas une demi-respiration pour une pause", () => {
    expect(decouper([...parole(20), ...silence(3), ...parole(5)])).toBe("continuer");
  });

  it("ne coupe jamais un mot de moins de 1,5 s", () => {
    expect(decouper([...parole(4), ...silence(6)])).toBe("continuer");
  });

  it("recycle un segment sans parole au bout de 4 s — sans voyage au serveur", () => {
    expect(decouper(silence(40))).toBe("couper-silence");
    expect(decouper(silence(20))).toBe("continuer");
  });

  it("plafonne à 8 s même en plein discours", () => {
    expect(decouper(parole(80))).toBe("couper");
  });

  it("un fond de bruit léger n'est pas de la parole", () => {
    expect(contientParole(silence(40))).toBe(false);
    expect(contientParole(parole(5))).toBe(true);
  });
});
