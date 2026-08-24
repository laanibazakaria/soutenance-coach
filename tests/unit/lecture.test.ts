import { describe, expect, it } from "vitest";
import { construirePromptLecture, parseLecture, contexteFiche, dossierSuffisant, LIMITES_LECTURE } from "../../lib/appel/lecture";

const FICHE = {
  sujet: "Comparaison de deux modèles de transcription sur des appels commerciaux.",
  compris: ["Le WER passe de 8,2 % à 6,9 %", "Douze fichiers de test annotés à la main"],
  chiffres: ["WER : 8,2 % puis 6,9 %", "Coût : 0,15 puis 0,21 dollar la minute"],
  fragilites: ["Aucun test de significativité sur douze fichiers", "La darija n'est pas couverte, sans que ce soit assumé"],
  angles: ["La validité statistique de l'échantillon", "Le surcoût de 40 % face au gain de 16 %"],
};

describe("lecture du dossier — la consigne", () => {
  it("place le dossier et exige des fragilités précises", () => {
    const p = construirePromptLecture("soutenance", "Le WER passe de 8,2 % à 6,9 % sur douze fichiers.");
    expect(p).toContain("rapporteur");
    expect(p).toContain("8,2 %");
    expect(p).toContain("pas une généralité applicable à n'importe quel travail");
    expect(p).toContain('"fragilites"');
  });

  it("change de personnage selon l'oral", () => {
    expect(construirePromptLecture("entretien", "x".repeat(500))).toContain("recruteur");
    expect(construirePromptLecture("pitch", "x".repeat(500))).toContain("concours d'innovation");
    expect(construirePromptLecture("concours", "x".repeat(500))).toContain("jury d'admission");
  });

  it("borne le dossier envoyé", () => {
    const p = construirePromptLecture("soutenance", "a".repeat(50_000));
    expect(p.length).toBeLessThan(LIMITES_LECTURE.dossierChars + 2000);
  });
});

describe("lecture du dossier — la fiche", () => {
  it("lit une fiche complète, même entourée de bavardage", () => {
    const f = parseLecture("Voici mes notes :\n```json\n" + JSON.stringify(FICHE) + "\n```")!;
    expect(f.sujet).toContain("transcription");
    expect(f.fragilites).toHaveLength(2);
    expect(f.angles[0]).toContain("statistique");
  });

  it("tolère les champs manquants ou mal typés", () => {
    const f = parseLecture(JSON.stringify({ sujet: "Un sujet", compris: "pas une liste", fragilites: [1, 2, "Une vraie fragilité repérée"] }))!;
    expect(f.compris).toEqual([]);
    expect(f.fragilites).toEqual(["Une vraie fragilité repérée"]);
    expect(f.chiffres).toEqual([]);
  });

  it("refuse une fiche vide de sens", () => {
    expect(parseLecture(JSON.stringify({ sujet: "", compris: [], fragilites: [] }))).toBeNull();
    expect(parseLecture("pas du json")).toBeNull();
    expect(parseLecture("{cassé")).toBeNull();
  });

  it("borne le nombre et la longueur des lignes", () => {
    const f = parseLecture(JSON.stringify({ sujet: "s", fragilites: Array.from({ length: 20 }, (_, i) => `fragilité ${i} ` + "x".repeat(500)) }))!;
    expect(f.fragilites).toHaveLength(LIMITES_LECTURE.listeMax);
    expect(f.fragilites[0]!.length).toBe(LIMITES_LECTURE.ligneChars);
  });
});

describe("lecture du dossier — ce qu'on remet au jury", () => {
  it("met les angles et les fragilités avant le reste", () => {
    const c = contexteFiche(FICHE);
    expect(c.indexOf("creuser")).toBeLessThan(c.indexOf("Chiffres relevés"));
    expect(c.indexOf("Fragilités")).toBeLessThan(c.indexOf("Acquis"));
    expect(c).toContain("c'est là qu'il faut appuyer");
    expect(c).toContain("La darija");
  });

  it("saute les sections vides et rend une chaîne vide sans fiche", () => {
    const c = contexteFiche({ sujet: "Un sujet", compris: [], chiffres: [], fragilites: [], angles: [] });
    expect(c).toContain("Un sujet");
    expect(c).not.toContain("Chiffres relevés");
    expect(contexteFiche(null)).toBe("");
  });

  it("juge si le dossier mérite une lecture", () => {
    expect(dossierSuffisant("trop court")).toBe(false);
    expect(dossierSuffisant("x".repeat(400))).toBe(true);
  });
});

describe("lecture du dossier — la profondeur", () => {
  it("laisse passer un mémoire entier, pas seulement son introduction", () => {
    // Un mémoire de cent pages fait environ 200 000 caractères ; on doit en
    // envoyer largement plus que l'introduction.
    expect(LIMITES_LECTURE.dossierChars).toBeGreaterThanOrEqual(60_000);
    const memoire = "Chapitre. ".repeat(6000);
    const p = construirePromptLecture("soutenance", memoire);
    expect(p.length).toBeGreaterThan(55_000);
  });

  it("garde la fin du document, là où sont les limites et la conclusion", async () => {
    const { extraitPourModele } = await import("../../lib/rapport");
    const texte = "DEBUT " + "x".repeat(100_000) + " CONCLUSION ET LIMITES";
    const extrait = extraitPourModele(texte, 45_000);
    expect(extrait).toContain("DEBUT");
    expect(extrait).toContain("CONCLUSION ET LIMITES");
    expect(extrait.length).toBeLessThanOrEqual(45_200);
  });
});
