import { describe, it, expect } from "vitest";
import {
  MODULES,
  IDS_MODULES,
  estProfilModule,
  fusionnerProfil,
  lienEtape,
  questionsClassiquesModule,
  construirePromptQuestionsModule,
  construirePromptEvaluationModule,
  etapesModule,
  type ProfilModule,
} from "../../lib/modules";
import { lireProfil, sauverProfil, marquerEtapeModule, cleQuestionsModule } from "../../lib/modules/persistance";
import { parseQuestionsEntretien } from "../../lib/entretien";
import { analyserReponse } from "../../lib/jury/evaluation";

const profil = (extra: Partial<ProfilModule> = {}): ProfilModule => ({
  module: "pitch",
  champs: { projet: "SoutenanceCoach", contexte: "Concours d'innovation ENSIAS", description: "Un coach d'oral pour étudiants. 40 utilisateurs en bêta, 221 tests." },
  documentTexte: "Slide 1 : le problème. Slide 2 : 40 utilisateurs en bêta. Slide 3 : demande de 5 000 € pour 6 mois.",
  documentNom: "pitch.pdf",
  etapesFaites: {},
  misAJourLe: "2026-08-23T10:00:00.000Z",
  ...extra,
});

function memoire() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("registre des modules", () => {
  it("chaque module est complet et cohérent", () => {
    for (const id of IDS_MODULES) {
      const m = MODULES[id];
      expect(m.id).toBe(id);
      expect(m.banque.length).toBeGreaterThanOrEqual(12);
      expect(m.etapes.length).toBe(7);
      expect(m.champs.some((c) => c.requis)).toBe(true);
      expect(m.guide.startsWith("/app/guide-")).toBe(true);
      expect(new Set(m.etapes.map((e) => e.id)).size).toBe(m.etapes.length);
    }
  });

  it("résout les liens d'étapes vers le bon préfixe", () => {
    const m = MODULES.concours;
    expect(lienEtape(m, "#profil")).toBe("/app/m/concours#profil");
    expect(lienEtape(m, "simulation")).toBe("/app/appel?mode=concours");
    expect(lienEtape(m, "appel")).toBe("/app/appel?mode=concours");
    expect(lienEtape(m, "guide#veille")).toBe("/app/guide-concours#veille");
    expect(lienEtape(m, "/app/session?mode=concours&format=3")).toBe("/app/session?mode=concours&format=3");
    expect(etapesModule(m, { profil: null, sessions: [], questionsGenerees: false }).map((e) => e.href)).toContain("/app/guide-concours");
  });

  it("les classiques ont des identifiants uniques par module", () => {
    const p = questionsClassiquesModule(MODULES.pitch);
    const c = questionsClassiquesModule(MODULES.concours);
    expect(new Set([...p, ...c].map((q) => q.id)).size).toBe(p.length + c.length);
    expect(p.every((q) => q.source === "classique" && q.attendu.length > 10)).toBe(true);
  });
});

describe("consignes", () => {
  it("les questions citent le dossier, exigent des faiblesses, interdisent le générique", () => {
    const p = construirePromptQuestionsModule(MODULES.pitch, profil());
    expect(p).toContain("jury d'innovation");
    expect(p).toContain("PROJET : SoutenanceCoach");
    expect(p).toContain("40 utilisateurs en bêta");
    expect(p).toContain("n'importe quel candidat est interdite");
    expect(p).toContain("faiblesse");
  });

  it("l'évaluation porte la persona et les critères du module, sans note", () => {
    const q = questionsClassiquesModule(MODULES.concours)[0];
    const analyse = analyserReponse("Je m'appelle Zakaria, j'ai par exemple fait un stage et 505 tests.", 1000);
    const p = construirePromptEvaluationModule(MODULES.concours, { question: q, reponse: "x", profil: profil({ module: "concours" }) }, analyse);
    expect(p).toContain("jury d'admission");
    expect(p).toContain("cohérence entre le parcours");
    expect(p).toContain("DOSSIER (texte extrait du PDF)");
    expect(p).toContain("AUCUNE note");
  });

  it("les questions générées se lisent avec le même parseur que l'entretien", () => {
    const q = parseQuestionsEntretien(JSON.stringify([
      { question: "Vous annoncez 40 utilisateurs en bêta : combien reviennent chaque semaine ?", pourquoi: "La traction réelle.", attendu: "Un chiffre de rétention.", categorie: "experience", cible: "les-deux" },
      { question: "5 000 € pour six mois : sur quoi exactement ?", pourquoi: "Le plan.", attendu: "Trois postes chiffrés.", categorie: "projection" },
      { question: "Qu'est-ce qui vous distingue d'un coach humain à 30 € l'heure ?", pourquoi: "La différence.", attendu: "Un argument concret.", categorie: "technique" },
    ]))!;
    expect(q).toHaveLength(3);
    expect(q[1].cible).toBe("les-deux");
  });
});

describe("profil : validation, fusion, persistance, checklist", () => {
  it("valide et rejette", () => {
    expect(estProfilModule(profil())).toBe(true);
    expect(estProfilModule(profil({ date: "2026-09-10" }))).toBe(true);
    expect(estProfilModule({ ...profil(), module: "autre" })).toBe(false);
    expect(estProfilModule({ ...profil(), champs: { projet: 3 } })).toBe(false);
  });

  it("fusionne champs du plus récent et union des étapes", () => {
    const local = profil({ misAJourLe: "2026-08-24T00:00:00.000Z", champs: { projet: "V2" }, etapesFaites: { pitch: "2026-08-24T00:00:00.000Z" } });
    const distant = profil({ etapesFaites: { guide: "2026-08-23T00:00:00.000Z" } });
    const f = fusionnerProfil(local, distant)!;
    expect(f.champs.projet).toBe("V2");
    expect(Object.keys(f.etapesFaites).sort()).toEqual(["guide", "pitch"]);
  });

  it("stocke par module, coche une étape, clé de cache par contenu", () => {
    const st = memoire();
    sauverProfil(st, profil());
    expect(lireProfil(st, "pitch")).toEqual(profil());
    expect(lireProfil(st, "concours")).toBeNull();
    const c = marquerEtapeModule(st, "pitch", "guide", true, "2026-08-25T00:00:00.000Z")!;
    expect(c.etapesFaites.guide).toBe("2026-08-25T00:00:00.000Z");
    expect(cleQuestionsModule(profil())).not.toBe(cleQuestionsModule(profil({ documentTexte: "autre" })));
  });

  it("la checklist détecte profil, pitch chronométré et questions", () => {
    const etats = etapesModule(MODULES.pitch, {
      profil: profil({ etapesFaites: { simulation: "x" } }),
      sessions: [{ id: "s", startedAt: "", durationMs: 1, transcript: "x", wordCount: 1, mode: "pitch" }],
      questionsGenerees: true,
    });
    const par = Object.fromEntries(etats.map((e) => [e.id, e]));
    expect(par.profil.source).toBe("auto");
    expect(par.pitch.source).toBe("auto");
    expect(par.questions.source).toBe("auto");
    expect(par.simulation.source).toBe("manuel");
    expect(par.veille.faite).toBe(false);
  });
});
