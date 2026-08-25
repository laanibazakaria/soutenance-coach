import { describe, it, expect } from "vitest";
import { nombresDe, memesNombres } from "./nombres";

/**
 * Les exemples viennent d'un test réel sur un PFE : le modèle avait signalé
 * comme contradictions chiffrées des phrases qui disaient le même nombre en
 * lettres. Ces cas-là sont figés ici.
 */
describe("lire les nombres d'une phrase", () => {
  it("lit les chiffres", () => {
    expect(nombresDe("45 pull requests produites — 38 intégrées")).toEqual([45, 38]);
  });

  it("lit les nombres écrits en lettres", () => {
    expect(nombresDe("quarante-cinq pull requests dont trente-huit intégrées")).toEqual([45, 38]);
  });

  it("compose au-delà de soixante", () => {
    expect(nombresDe("soixante-dix-huit")).toEqual([78]);
    expect(nombresDe("quatre-vingt-dix")).toEqual([90]);
  });

  it("relie les composés par « et »", () => {
    expect(nombresDe("vingt et un jours")).toEqual([21]);
  });

  it("multiplie par cent et mille", () => {
    expect(nombresDe("deux cents")).toEqual([200]);
    expect(nombresDe("trois mille")).toEqual([3000]);
  });

  it("sépare deux nombres qui se suivent sans se composer", () => {
    expect(nombresDe("cinq trois")).toEqual([5, 3]);
  });

  it("ignore les accents et la casse", () => {
    expect(nombresDe("Zéro scénario")).toEqual([0]);
  });

  it("ne trouve rien là où il n'y a rien", () => {
    expect(nombresDe("une méthode robuste")).toEqual([1]);
    expect(nombresDe("la méthode est robuste")).toEqual([]);
  });
});

describe("comparer deux citations", () => {
  it("reconnaît la même valeur écrite autrement", () => {
    // Le faux écart n° 4 du test réel.
    expect(
      memesNombres(
        "45 pull requests produites — 38 intégrées à la branche principale",
        "quarante-cinq pull requests ont été produites dont trente-huit intégrées à la branche principale",
      ),
    ).toBe(true);
  });

  it("reconnaît « 2 éliminés » et « deux scénarios »", () => {
    // Le faux écart n° 6 : « 0 restant — 2 éliminés » contre « deux scénarios
    // ne peuvent plus se reproduire ». Les nombres diffèrent en compte, donc on
    // ne filtre pas : c'est au prompt de trancher, pas au code de deviner.
    expect(memesNombres("0 scénario restant — 2 éliminés", "deux scénarios ne peuvent plus se reproduire")).toBe(false);
  });

  it("laisse passer une vraie contradiction chiffrée", () => {
    // Le seul vrai écart du test réel.
    expect(memesNombres("Sept missions en six semaines", "six missions successives")).toBe(false);
  });

  it("ne filtre rien quand aucune des deux ne porte de nombre", () => {
    expect(memesNombres("une idée", "la même idée")).toBe(false);
  });
});
