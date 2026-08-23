import { describe, it, expect } from "vitest";
import { construireSeance, validerRetour, synthese, estSeanceAmi, LIMITES_AMI } from "../../lib/ami";
import { validerRetourOral, regrouper } from "../../lib/retours";

describe("répéter avec un ami", () => {
  const seance = construireSeance("Soutenance PFA", "Jury de soutenance", 45, [
    { question: "Pourquoi le WER plutôt qu'une évaluation humaine ?", pourquoi: "Mesurer ou croire.", attendu: "Un chiffre." },
    { question: "court", pourquoi: "x" },
    { question: "12 fichiers, est-ce suffisant ?", pourquoi: "Les limites." },
  ], new Date("2026-08-24T10:00:00Z"));

  it("construit une séance propre : questions trop courtes écartées, durée bornée", () => {
    expect(seance.questions).toHaveLength(2);
    expect(seance.dureeS).toBe(45);
    expect(construireSeance("t", "j", 999, []).dureeS).toBe(180);
    expect(construireSeance("t", "j", 5, []).dureeS).toBe(20);
    expect(estSeanceAmi(seance)).toBe(true);
    expect(estSeanceAmi({ type: "autre" })).toBe(false);
  });

  it("valide un retour : une réponse par question, texte borné, et refuse le reste", () => {
    const r = validerRetour({ nom: "Sara", reponses: [{ clair: true, complet: "oui", convaincant: true, remarque: " Bien, mais trop long. " }, { clair: false }], commentaire: "Bravo" }, 2, new Date("2026-08-24T11:00:00Z"))!;
    expect(r.reponses[0]).toEqual({ clair: true, complet: false, convaincant: true, remarque: "Bien, mais trop long." });
    expect(r.reponses[1]).toEqual({ clair: false, complet: false, convaincant: false });
    expect(r.nom).toBe("Sara");
    expect(validerRetour({ reponses: [{}] }, 2)).toBeNull();
    expect(validerRetour("non", 2)).toBeNull();
    expect(validerRetour({ nom: "x".repeat(100), reponses: [{}, {}] }, 2)!.nom).toHaveLength(LIMITES_AMI.nomMax);
  });

  it("fait la synthèse par question", () => {
    const s = { ...seance, retours: [validerRetour({ nom: "Sara", reponses: [{ clair: true, complet: true, convaincant: false, remarque: "Cite le chiffre." }, { clair: true }], commentaire: "Bien." }, 2)!, validerRetour({ reponses: [{ clair: true }, { clair: false, complet: true }] }, 2)!] };
    const sy = synthese(s);
    expect(sy.nb).toBe(2);
    expect(sy.parQuestion[0]).toMatchObject({ clair: 2, complet: 1, convaincant: 0, remarques: ["Cite le chiffre."] });
    expect(sy.commentaires).toEqual(["Sara : Bien."]);
  });
});

describe("les vraies questions des jurys", () => {
  it("valide, nettoie, dédoublonne, borne l'année", () => {
    const r = validerRetourOral({ type: "soutenance", ecole: " ENSIAS ", filiere: "IA", niveau: "PFA", annee: 2030, questions: "Pourquoi le WER ?\nPourquoi le WER ?\ncourt\nCombien de fichiers audio avez-vous utilisés ?", conseil: "Connaître ses chiffres." }, 2026)!;
    expect(r.ecole).toBe("ENSIAS");
    expect(r.annee).toBe(2026);
    expect(r.questions).toEqual(["Pourquoi le WER ?", "Combien de fichiers audio avez-vous utilisés ?"]);
    expect(r.conseil).toBe("Connaître ses chiffres.");
    expect(validerRetourOral({ type: "soutenance", questions: ["court"] }, 2026)).toBeNull();
    expect(validerRetourOral({ type: "autre", questions: ["Une question assez longue ?"] }, 2026)).toBeNull();
    expect(validerRetourOral({ type: "entretien", questions: ["Présentez-vous en deux minutes."] }, 2026)!.ecole).toBe("Non précisée");
  });

  it("regroupe par école et filière, les plus fournis d'abord", () => {
    const base = { type: "soutenance" as const, niveau: "PFA", annee: 2026, creeLe: "2026-08-24T00:00:00.000Z" };
    const g = regrouper([
      { ...base, ecole: "ENSIAS", filiere: "IA", questions: ["Q1 longue question ?"], conseil: "C1" },
      { ...base, ecole: "ensias", filiere: "ia", questions: ["Q1 longue question ?", "Q2 autre question ?"] },
      { ...base, ecole: "EMI", filiere: "Info", questions: ["Q3 question EMI ?"] },
    ]);
    expect(g[0]).toMatchObject({ ecole: "ENSIAS", nb: 2, questions: ["Q1 longue question ?", "Q2 autre question ?"], conseils: ["C1"] });
    expect(g[1].ecole).toBe("EMI");
  });
});
