import { describe, it, expect } from "vitest";
import { construirePromptCoach, parseAvisCoach, LIMITES_COACH } from "../../lib/coach";
import { computeReport } from "../../lib/scoring";

const transcript =
  "Bonjour à tous. Je vais vous présenter mon projet de fin d'études en trois parties : le contexte, la méthode et les résultats. " +
  "Euh, du coup le contexte c'est une application de transcription. Pour conclure, merci de votre attention.";

const rapport = computeReport({ transcript, durationMs: 60_000, targetDurationMs: 60_000 });

describe("construirePromptCoach", () => {
  it("interdit toute note et transmet les mesures comme des faits", () => {
    const p = construirePromptCoach({ transcript, durationMs: 60_000, targetDurationMs: 60_000 }, rapport);
    expect(p).toContain("AUCUNE note");
    expect(p).toContain("ne les contredis pas");
    expect(p).toContain("1 min 00 s pour 1 min 00 s visées");
    expect(p).toContain("Débit");
  });

  it("numérote les diapositives et le temps passé dessus", () => {
    const p = construirePromptCoach(
      {
        transcript,
        durationMs: 60_000,
        slides: [
          { numero: 1, titre: "Contexte", texte: "Contexte\nUne application de transcription" },
          { numero: 2, titre: "Résultats", texte: "Résultats\n45 PR, 505 tests" },
        ],
        slidesTiming: [{ numero: 1, dureeMs: 40_000 }],
      },
      rapport,
    );
    expect(p).toContain("[Diapositive 1] Contexte");
    expect(p).toContain("[Diapositive 2] Résultats");
    expect(p).toContain("diapositive 1 : 0 min 40 s");
    expect(p).toContain("entraînement libre");
  });

  it("sans support, demande explicitement de laisser les oublis vides", () => {
    const p = construirePromptCoach({ transcript, durationMs: 60_000 }, rapport);
    expect(p).toContain("SUPPORT : inconnu");
    expect(p).toContain('laisse "oublis" vide');
  });

  it("borne ce qui est envoyé", () => {
    const long = "mot ".repeat(5000);
    const p = construirePromptCoach(
      { transcript: long, durationMs: 60_000, slides: [{ numero: 1, titre: "T", texte: "x".repeat(9000) }] },
      rapport,
    );
    expect(p.length).toBeLessThan(LIMITES_COACH.transcriptChars + LIMITES_COACH.slidesChars + 3000);
    expect(p).toContain("[…]");
  });
});

describe("parseAvisCoach", () => {
  const valide = {
    oublis: ["Diapositive 2 : les 505 tests ne sont jamais mentionnés."],
    confus: ['"du coup le contexte c\'est" — on ne sait pas de quel contexte tu parles.'],
    reformulations: [{ avant: "du coup le contexte c'est une application", apres: "Le contexte : une application de transcription utilisée en production." }],
    points_forts: ["Tu annonces ton plan dès la première phrase."],
    priorite: "Nomme tes chiffres : 45 PR, 505 tests.",
  };

  it("accepte un avis complet, même entouré de texte", () => {
    const a = parseAvisCoach("Voici :\n```json\n" + JSON.stringify(valide) + "\n```");
    expect(a).toEqual(valide);
  });

  it("accepte des oublis et des reformulations vides ou absents", () => {
    const a = parseAvisCoach(JSON.stringify({ ...valide, oublis: [], reformulations: undefined }));
    expect(a?.oublis).toEqual([]);
    expect(a?.reformulations).toEqual([]);
  });

  it("refuse sans priorité, sans point fort, ou si reformulations n'est pas une liste", () => {
    expect(parseAvisCoach(JSON.stringify({ ...valide, priorite: "" }))).toBeNull();
    expect(parseAvisCoach(JSON.stringify({ ...valide, points_forts: [] }))).toBeNull();
    expect(parseAvisCoach(JSON.stringify({ ...valide, reformulations: "non" }))).toBeNull();
    expect(parseAvisCoach("pas du json")).toBeNull();
  });

  it("tronque les listes trop longues et ignore les reformulations incomplètes", () => {
    const a = parseAvisCoach(
      JSON.stringify({
        ...valide,
        oublis: ["a", "b", "c", "d", "e", "f"],
        reformulations: [{ avant: "x" }, { avant: "y", apres: "z" }],
      }),
    );
    expect(a?.oublis).toHaveLength(4);
    expect(a?.reformulations).toEqual([{ avant: "y", apres: "z" }]);
  });
});
