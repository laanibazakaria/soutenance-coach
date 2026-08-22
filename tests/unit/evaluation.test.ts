import { describe, it, expect } from "vitest";
import {
  analyserReponse,
  construirePrompt,
  parseAvis,
  SEUILS_REPONSE,
} from "../../lib/jury/evaluation";
import type { JuryQuestion } from "../../lib/slides/types";

const question: JuryQuestion = {
  id: "q1",
  question: "Comment avez-vous évalué la fiabilité de votre modèle ?",
  pourquoi: "Le jury veut savoir si vous mesurez, ou si vous croyez.",
  categorie: "technique",
};

const constat = (a: ReturnType<typeof analyserReponse>, id: string) => {
  const c = a.constats.find((x) => x.id === id);
  if (!c) throw new Error(`constat ${id} absent`);
  return c;
};

describe("analyserReponse — longueur", () => {
  it("réponse vide → alerte, message explicite", () => {
    const c = constat(analyserReponse(""), "longueur");
    expect(c.niveau).toBe("alerte");
    expect(c.message).toContain("Aucune réponse captée");
  });

  it("réponse d'un mot → alerte", () => {
    expect(constat(analyserReponse("oui"), "longueur").niveau).toBe("alerte");
  });

  it("réponse de bonne longueur → bon", () => {
    const texte = Array(60).fill("mot").join(" ");
    expect(constat(analyserReponse(texte), "longueur").niveau).toBe("bon");
  });

  it("réponse interminable → attention avec un conseil d'arrêt", () => {
    const c = constat(analyserReponse(Array(250).fill("mot").join(" ")), "longueur");
    expect(c.niveau).toBe("attention");
    expect(c.message).toContain("étales");
  });
});

describe("analyserReponse — hésitation", () => {
  it("réponse trop courte → hésitation non jugée", () => {
    expect(constat(analyserReponse("euh oui"), "hesitation").niveau).toBe("absent");
  });

  it("réponse fluide → bon", () => {
    const texte = Array(50).fill("contenu").join(" ");
    const c = constat(analyserReponse(texte), "hesitation");
    expect(c.niveau).toBe("bon");
    expect(c.message).toContain("Aucune hésitation");
  });

  it("réponse hésitante → attention, avec le conseil du silence", () => {
    const texte = ("euh donc " + Array(6).fill("mot").join(" ") + " ").repeat(5);
    const c = constat(analyserReponse(texte), "hesitation");
    expect(c.niveau).toBe("attention");
    expect(c.message).toContain("silence");
  });
});

describe("analyserReponse — concret", () => {
  const base = Array(40).fill("contenu").join(" ");

  it("réponse sans exemple ni chiffre → attention", () => {
    expect(constat(analyserReponse(base), "concret").niveau).toBe("attention");
  });

  it("« par exemple » suffit à marquer le concret", () => {
    expect(constat(analyserReponse(base + " par exemple ceci"), "concret").niveau).toBe("bon");
  });

  it("un chiffre avec unité marque aussi le concret", () => {
    expect(constat(analyserReponse(base + " sur 505 tests"), "concret").niveau).toBe("bon");
  });
});

describe("analyserReponse — latence", () => {
  const texte = Array(50).fill("mot").join(" ");

  it("latence inconnue → non mesurée", () => {
    expect(constat(analyserReponse(texte), "latence").niveau).toBe("absent");
  });

  it("démarrage rapide → bon", () => {
    expect(constat(analyserReponse(texte, 3000), "latence").niveau).toBe("bon");
  });

  it("long silence avant de répondre → attention, avec la parade", () => {
    const c = constat(analyserReponse(texte, 15_000), "latence");
    expect(c.niveau).toBe("attention");
    expect(c.message).toContain("reformulant");
  });
});

describe("analyserReponse — robustesse", () => {
  it("renvoie toujours les quatre constats, dans un ordre stable", () => {
    expect(analyserReponse("").constats.map((c) => c.id)).toEqual([
      "longueur",
      "hesitation",
      "concret",
      "latence",
    ]);
  });

  it("déterminisme", () => {
    const t = "par exemple nous avons mesuré 94 % de précision sur le jeu de test";
    expect(analyserReponse(t, 2000)).toEqual(analyserReponse(t, 2000));
  });
});

describe("construirePrompt — le garde-fou est dans la consigne", () => {
  const analyse = analyserReponse(Array(50).fill("mot").join(" "), 3000);
  const prompt = construirePrompt({ question, reponse: "ma réponse" }, analyse);

  it("interdit explicitement toute note chiffrée", () => {
    expect(prompt).toContain("AUCUNE note");
    expect(prompt).toContain("AUCUN score");
  });

  it("transmet la question, sa justification et la réponse", () => {
    expect(prompt).toContain(question.question);
    expect(prompt).toContain(question.pourquoi);
    expect(prompt).toContain("ma réponse");
  });

  it("transmet les mesures déjà calculées et interdit de les recalculer", () => {
    expect(prompt).toContain("ne les recalcule pas");
    expect(prompt).toContain("mots : une réponse de bonne longueur");
  });

  it("le contexte des slides est tronqué pour rester raisonnable", () => {
    const long = "x".repeat(5000);
    const p = construirePrompt({ question, reponse: "r", contexteSlides: long }, analyse);
    expect(p).toContain("CONTEXTE DU PROJET");
    expect(p.length).toBeLessThan(4000);
  });

  it("sans slides, aucune section contexte n'est ajoutée", () => {
    expect(prompt).not.toContain("CONTEXTE DU PROJET");
  });
});

describe("parseAvis — on refuse plutôt que de deviner", () => {
  const valide = {
    points_forts: ["Tu cites une métrique précise."],
    points_faibles: ["Tu ne dis pas sur quel jeu de données."],
    attendu: "Le jury attendait le protocole d'évaluation.",
    relance: "Et sur des données jamais vues ?",
  };

  it("JSON propre → avis valide", () => {
    expect(parseAvis(JSON.stringify(valide))).toEqual(valide);
  });

  it("JSON entouré de texte ou de balises → extrait quand même", () => {
    const brut = "Voici mon analyse :\n```json\n" + JSON.stringify(valide) + "\n```\nVoilà.";
    expect(parseAvis(brut)).toEqual(valide);
  });

  it("texte sans JSON → refusé", () => {
    expect(parseAvis("Bonne réponse, continue comme ça !")).toBeNull();
  });

  it("JSON invalide → refusé", () => {
    expect(parseAvis("{ points_forts: [oups }")).toBeNull();
  });

  it("champs manquants → refusé", () => {
    expect(parseAvis(JSON.stringify({ points_forts: ["a"] }))).toBeNull();
  });

  it("listes vides → refusé (un avis vide ne vaut pas mieux que rien)", () => {
    expect(parseAvis(JSON.stringify({ ...valide, points_forts: [] }))).toBeNull();
  });

  it("les listes trop longues sont tronquées à trois éléments", () => {
    const avis = parseAvis(
      JSON.stringify({ ...valide, points_faibles: ["a", "b", "c", "d", "e"] }),
    );
    expect(avis?.points_faibles).toHaveLength(3);
  });

  it("les entrées non textuelles sont filtrées", () => {
    const avis = parseAvis(JSON.stringify({ ...valide, points_forts: [42, "vrai point", null] }));
    expect(avis?.points_forts).toEqual(["vrai point"]);
  });
});

describe("SEUILS_REPONSE", () => {
  it("les seuils restent cohérents et exportés", () => {
    expect(SEUILS_REPONSE.motsIdeaux.min).toBeLessThan(SEUILS_REPONSE.motsIdeaux.max);
    expect(SEUILS_REPONSE.motsMinimum).toBeLessThan(SEUILS_REPONSE.motsIdeaux.min);
  });
});
