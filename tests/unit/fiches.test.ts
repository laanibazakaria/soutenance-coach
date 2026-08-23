import { describe, it, expect } from "vitest";
import {
  construirePromptFiches,
  parseFiches,
  reviser,
  fichesDues,
  bilan,
  INTERVALLES,
  NIVEAU_ACQUIS,
  LIMITES_FICHES,
  type Fiche,
  type EtatFiche,
} from "../../lib/fiches";

const slides = [
  { numero: 1, titre: "Contexte", texte: "Contexte\nStage chez Propulsez" },
  { numero: 2, titre: "Résultats", texte: "Résultats\n45 pull requests, 505 tests" },
];

const brut = JSON.stringify({
  fiches: [
    { type: "chiffre", recto: "Combien de tests automatisés ?", verso: "505 tests, exécutés à chaque PR.", slide: 2 },
    { type: "definition", recto: "Qu'est-ce qu'une validation A/B ?", verso: "Comparer deux versions sur les mêmes données.", slide: 2 },
    { type: "choix", recto: "Pourquoi AssemblyAI ?", verso: "À préparer : le support ne le dit pas. Pistes : coût, qualité fr.", slide: 1 },
    { type: "piege", recto: "Et si le modèle se trompe en production ?", verso: "Les tests de non-régression et le GO conditionnel.", slide: 2 },
    { type: "inconnu", recto: "x", verso: "y", slide: 1 },
    { type: "chiffre", recto: "Combien de tests automatisés ?", verso: "doublon", slide: 2 },
    { type: "chiffre", recto: "", verso: "vide", slide: 2 },
  ],
});

describe("construirePromptFiches", () => {
  it("numérote les diapositives, borne le nombre de fiches et interdit d'inventer", () => {
    const p = construirePromptFiches(slides);
    expect(p).toContain("[Diapositive 2] Résultats");
    expect(p).toContain(`Entre ${LIMITES_FICHES.min} et ${LIMITES_FICHES.max} fiches`);
    expect(p).toContain("INTERDIT d'inventer un chiffre");
    expect(p).toContain('"piege"');
  });
});

describe("parseFiches", () => {
  it("garde les fiches valides, ignore les types inconnus, les vides et les doublons", () => {
    const f = parseFiches("```json\n" + brut + "\n```", 2)!;
    expect(f.map((x) => x.type)).toEqual(["chiffre", "definition", "choix", "piege"]);
    expect(f[0].id).toMatch(/^f-/);
    expect(new Set(f.map((x) => x.id)).size).toBe(4);
  });

  it("identifiants stables : même recto, même id", () => {
    const a = parseFiches(brut, 2)!;
    const b = parseFiches(brut, 2)!;
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it("un numéro de diapositive hors support devient 0 (inconnu), pas une invention", () => {
    const f = parseFiches(JSON.stringify({ fiches: [1, 2, 3].map((i) => ({ type: "chiffre", recto: `q${i}`, verso: "v", slide: 9 })) }), 2)!;
    expect(f.every((x) => x.slide === 0)).toBe(true);
  });

  it("refuse une liste trop courte ou mal formée", () => {
    expect(parseFiches(JSON.stringify({ fiches: [{ type: "chiffre", recto: "q", verso: "v", slide: 1 }] }), 2)).toBeNull();
    expect(parseFiches(JSON.stringify({ fiches: "non" }), 2)).toBeNull();
    expect(parseFiches("pas du json", 2)).toBeNull();
  });
});

describe("reviser — révision espacée", () => {
  it("monte d'un niveau à chaque bonne réponse, avec des intervalles croissants", () => {
    let e: EtatFiche | undefined;
    e = reviser(e, "su", "2026-09-01");
    expect(e).toEqual({ niveau: 1, prochaine: "2026-09-02", vues: 1, ratees: 0 });
    e = reviser(e, "su", "2026-09-02");
    expect(e.niveau).toBe(2);
    expect(e.prochaine).toBe("2026-09-05"); // +3
    e = reviser(e, "su", "2026-09-05");
    expect(e.prochaine).toBe("2026-09-12"); // +7
    e = reviser(e, "su", "2026-09-12");
    expect(e.niveau).toBe(INTERVALLES.length);
    expect(e.prochaine).toBe("2026-09-26"); // +14, plafonné
    e = reviser(e, "su", "2026-09-26");
    expect(e.niveau).toBe(INTERVALLES.length);
  });

  it("une fiche ratée retombe au niveau 0 et revient aujourd'hui", () => {
    const e = reviser({ niveau: 3, prochaine: "2026-09-20", vues: 4, ratees: 0 }, "pas-su", "2026-09-10");
    expect(e).toEqual({ niveau: 0, prochaine: "2026-09-10", vues: 5, ratees: 1 });
  });
});

describe("fichesDues et bilan", () => {
  const fiches: Fiche[] = ["a", "b", "c", "d"].map((id, i) => ({ id, type: "chiffre", recto: id, verso: id, slide: i + 1 }));
  const etats: Record<string, EtatFiche> = {
    a: { niveau: 0, prochaine: "2026-09-10", vues: 2, ratees: 2 }, // ratée
    b: { niveau: 3, prochaine: "2026-09-20", vues: 3, ratees: 0 }, // acquise, pas due
    c: { niveau: 1, prochaine: "2026-09-09", vues: 1, ratees: 0 }, // échue
    // d : jamais vue
  };

  it("ordonne : ratées, puis nouvelles, puis échues — et exclut les non dues", () => {
    expect(fichesDues(fiches, etats, "2026-09-10").map((f) => f.id)).toEqual(["a", "d", "c"]);
  });

  it("compte total, dues, acquises, nouvelles et difficiles", () => {
    const b = bilan(fiches, etats, "2026-09-10");
    expect(b).toMatchObject({ total: 4, dues: 3, acquises: 1, nouvelles: 1 });
    expect(b.difficiles.map((f) => f.id)).toEqual(["a"]);
    expect(NIVEAU_ACQUIS).toBe(3);
  });
});
