import { describe, it, expect } from "vitest";
import { normaliser, GRILLES } from "./index";

/**
 * La page publique montre une grille d'exemple pour dire une chose précise :
 * « la note, c'est le code qui la calcule ». Si le chiffre affiché n'était pas
 * celui que ce code produit, la démonstration démentirait son propre argument.
 *
 * Ce test fige donc l'exemple de app/page.tsx. Il échouera si quelqu'un change
 * les poids de la grille, le seuil de suffisance ou l'arrondi sans mettre la
 * page à jour — ce qui est exactement le moment où il faut s'en apercevoir.
 */
describe("la grille d'exemple de la page publique", () => {
  const EXEMPLE = [
    { id: 2, titre: "Problématique explicite", poids: 2, note: 8 },
    { id: 4, titre: "Méthode justifiée", poids: 2, note: 6 },
    { id: 5, titre: "Résultats chiffrés", poids: 2, note: 6 },
    { id: 8, titre: "Maîtrise de ses chiffres", poids: 1.5, note: 4 },
    { id: 11, titre: "Posture et regard", poids: 1, note: null },
  ] as const;

  const brut = { criteres: EXEMPLE.map((c) => ({ id: c.id, note: c.note, pourquoi: "" })) };

  it("affiche 6,1 — la note que le code calcule vraiment", () => {
    expect(normaliser(brut, GRILLES.soutenance).note).toBe(6.1);
  });

  it("retient assez de poids pour qu'une note existe", () => {
    // Sous le seuil, la grille s'abstient : l'exemple doit rester au-dessus,
    // sinon la page montrerait une note là où l'application n'en donnerait pas.
    const r = normaliser(brut, GRILLES.soutenance);
    expect(r.note).not.toBeNull();
  });

  it("donne à chaque critère montré le poids qu'il a dans la vraie grille", () => {
    for (const c of EXEMPLE) {
      const vrai = GRILLES.soutenance.criteres.find((x) => x.id === c.id);
      expect(vrai, `critère ${c.id} absent de la grille`).toBeDefined();
      expect(vrai!.titre).toBe(c.titre);
      expect(vrai!.poids).toBe(c.poids);
    }
  });
});
