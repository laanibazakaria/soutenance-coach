import { describe, it, expect } from "vitest";
import {
  questionsClassiques,
  construirePromptQuestionsEntretien,
  parseQuestionsEntretien,
  construirePromptEvaluationEntretien,
  fusionnerCandidature,
  estCandidature,
  etapesEntretien,
  ETAPES_ENTRETIEN,
  type Candidature,
} from "../../lib/entretien";
import { lireCandidature, sauverCandidature, marquerEtapeEntretien, cleQuestionsEntretien } from "../../lib/entretien/persistance";
import { analyserReponse } from "../../lib/jury/evaluation";

const candidature = (extra: Partial<Candidature> = {}): Candidature => ({
  poste: "Ingénieur IA junior",
  entreprise: "Propulsez",
  typeEntretien: "mixte",
  offre: "Nous cherchons un ingénieur IA maîtrisant Python, les LLM et la mise en production. Anglais courant exigé.",
  cvTexte: "Zakaria Laaniba — ENSIAS. Stage Propulsez 2026 : fiabilisation d'une application d'IA, 45 PR, 505 tests. Projets : assistant juridique RAG.",
  etapesFaites: {},
  misAJourLe: "2026-08-23T10:00:00.000Z",
  ...extra,
});

function memoire() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("banque classique", () => {
  it("filtre par rôle et garde les questions communes", () => {
    const rh = questionsClassiques("rh");
    const tech = questionsClassiques("technique");
    expect(rh.some((q) => q.question.startsWith("Présentez-vous"))).toBe(true);
    expect(tech.some((q) => q.question.startsWith("Présentez-vous"))).toBe(true);
    expect(rh.some((q) => q.categorie === "technique")).toBe(false);
    expect(tech.some((q) => q.question.includes("prétentions"))).toBe(false);
    expect(questionsClassiques().length).toBeGreaterThanOrEqual(18);
    expect(new Set(questionsClassiques().map((q) => q.id)).size).toBe(questionsClassiques().length);
  });
});

describe("consignes", () => {
  it("les questions citent le CV et l'offre, exigent les écarts, interdisent le générique", () => {
    const p = construirePromptQuestionsEntretien(candidature());
    expect(p).toContain("POSTE VISÉ : Ingénieur IA junior");
    expect(p).toContain("Anglais courant exigé");
    expect(p).toContain("505 tests");
    expect(p).toContain("ÉCARTS entre le CV et l'offre");
    expect(p).toContain("n'importe quel candidat est interdite");
  });

  it("l'évaluation change de persona selon le rôle et interdit toute note", () => {
    const q = questionsClassiques("rh")[0];
    const analyse = analyserReponse("Je suis ingénieur en IA, j'ai fait un stage chez Propulsez où j'ai par exemple fiabilisé une application, avec 505 tests.", 2000);
    const rh = construirePromptEvaluationEntretien({ question: q, reponse: "x", role: "rh", candidature: candidature() }, analyse);
    const tech = construirePromptEvaluationEntretien({ question: q, reponse: "x", role: "technique" }, analyse);
    expect(rh).toContain("recruteur RH");
    expect(rh).toContain("méthode STAR");
    expect(rh).toContain("CV DU CANDIDAT");
    expect(tech).toContain("manager technique");
    expect(tech).not.toContain("CV DU CANDIDAT");
    expect(rh).toContain("AUCUNE note");
  });

  it("borne l'offre et le CV envoyés", () => {
    const p = construirePromptQuestionsEntretien(candidature({ offre: "o".repeat(20000), cvTexte: "c".repeat(20000) }));
    expect(p.length).toBeLessThan(4000 + 6000 + 2500);
  });
});

describe("parseQuestionsEntretien", () => {
  it("accepte un tableau, fixe les valeurs par défaut, refuse une liste trop courte", () => {
    const brut = JSON.stringify([
      { question: "Vous indiquez 505 tests : lesquels avez-vous écrits vous-même ?", pourquoi: "Vérifier la part réelle.", attendu: "Des exemples précis.", categorie: "technique", cible: "technique" },
      { question: "L'offre exige l'anglais courant ; votre CV n'en parle pas. Où en êtes-vous ?", pourquoi: "Un écart avec l'offre.", categorie: "inconnue", cible: "rh" },
      { question: "Pourquoi un assistant juridique, vous qui visez l'IA en production ?", pourquoi: "Cohérence.", attendu: "", categorie: "motivation", cible: "nimporte" },
      { question: "court", pourquoi: "x" },
    ]);
    const q = parseQuestionsEntretien("```json\n" + brut + "\n```")!;
    expect(q).toHaveLength(3);
    expect(q[1].categorie).toBe("experience");
    expect(q[1].attendu).toContain("exemple");
    expect(q[2].cible).toBe("les-deux");
    expect(q.every((x) => x.source === "ia")).toBe(true);
    expect(parseQuestionsEntretien(JSON.stringify([{ question: "Une seule question valable ?", pourquoi: "x" }]))).toBeNull();
  });
});

describe("candidature : validation, fusion, persistance", () => {
  it("valide la forme et rejette une date mal formée", () => {
    expect(estCandidature(candidature())).toBe(true);
    expect(estCandidature(candidature({ dateEntretien: "2026-09-10" }))).toBe(true);
    expect(estCandidature({ ...candidature(), dateEntretien: "demain" })).toBe(false);
    expect(estCandidature({ poste: "x" })).toBe(false);
  });

  it("fusionne : champs du plus récent, union des étapes", () => {
    const local = candidature({ poste: "Data engineer", misAJourLe: "2026-08-24T00:00:00.000Z", etapesFaites: { pitch: "2026-08-24T00:00:00.000Z" } });
    const distant = candidature({ misAJourLe: "2026-08-23T00:00:00.000Z", etapesFaites: { guide: "2026-08-23T00:00:00.000Z" } });
    const f = fusionnerCandidature(local, distant)!;
    expect(f.poste).toBe("Data engineer");
    expect(Object.keys(f.etapesFaites).sort()).toEqual(["guide", "pitch"]);
  });

  it("relit ce qu'elle écrit, coche une étape, et la clé de cache dépend du contenu", () => {
    const st = memoire();
    expect(marquerEtapeEntretien(st, "guide", true)).toBeNull();
    sauverCandidature(st, candidature());
    expect(lireCandidature(st)).toEqual(candidature());
    const c = marquerEtapeEntretien(st, "guide", true, "2026-08-25T00:00:00.000Z")!;
    expect(c.etapesFaites.guide).toBe("2026-08-25T00:00:00.000Z");
    expect(cleQuestionsEntretien(candidature())).not.toBe(cleQuestionsEntretien(candidature({ poste: "autre" })));
    expect(cleQuestionsEntretien(candidature())).toMatch(/^entretien-questions:/);
  });
});

describe("checklist du module", () => {
  it("détecte le profil, le pitch et les questions ; le reste se coche", () => {
    const etats = etapesEntretien({
      candidature: candidature({ etapesFaites: { simulation: "2026-08-25T00:00:00.000Z" } }),
      sessions: [{ id: "s", startedAt: "2026-08-25T00:00:00.000Z", durationMs: 120000, transcript: "x", wordCount: 1, mode: "entretien" }],
      questionsGenerees: false,
    });
    const par = Object.fromEntries(etats.map((e) => [e.id, e]));
    expect(par.profil.source).toBe("auto");
    expect(par.pitch.source).toBe("auto");
    expect(par.questions.faite).toBe(false);
    expect(par.simulation.source).toBe("manuel");
    expect(par.guide.faite).toBe(false);
    expect(etats).toHaveLength(ETAPES_ENTRETIEN.length);
  });
});
