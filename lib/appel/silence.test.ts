import { describe, it, expect } from "vitest";
import { construirePromptTour, type ContexteAppel } from "./index";

/**
 * Un appel réel a montré le défaut : le candidat n'a rien dit, le client a
 * envoyé « (silence) », et le jury a enchaîné une question plus dure en tenant
 * pour acquis ce qui n'avait jamais été confirmé. Le prompt ne disait rien de
 * ce cas. Ces tests gardent la consigne en place.
 */
const base = (historique: ContexteAppel["historique"]): ContexteAppel => ({
  mode: "soutenance",
  contexte: "## Mémoire\nUn travail sur la détection d'anomalies.",
  langue: "fr",
  dureeMin: 10,
  historique,
});

describe("le jury devant un silence", () => {
  it("reçoit la conduite à tenir : relancer, jamais empiler", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("SI LE CANDIDAT N'A RIEN DIT");
    expect(p).toContain("ne pose PAS de nouvelle question");
  });

  it("est prévenu qu'un silence n'est pas un aveu", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("Un silence n'est jamais un aveu");
  });

  it("garde le droit de reprendre la parole après un blanc", () => {
    // La règle de rotation interdit deux tours d'affilée : sans exception
    // nommée, les deux consignes se contrediraient.
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("si le candidat n'a rien répondu");
  });
});

describe("ce que le jury a le droit de citer", () => {
  it("n'invente ni page, ni ligne, ni chiffre", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("CE QUE TU CITES");
    expect(p).toContain("que s'il figure vraiment dans le dossier");
  });

  it("pose ses déductions en question, pas en fait établi", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("et non comme un fait établi");
  });
});

/**
 * Un appel réel a produit trois affirmations contradictoires sur « la ligne 123
 * de l'annexe A » : un async, puis un async sans await, puis un await bien
 * présent. Le prompt ordonnait « cite-le précisément » alors que le modèle ne
 * tient qu'un extrait de 7 000 signes — on lui demandait d'être précis sur ce
 * qu'il n'a pas sous les yeux.
 */
describe("le dossier tel qu'il est présenté au jury", () => {
  it("annonce un extrait, pas le dossier entier", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("un extrait du dossier, pas le dossier entier");
    expect(p).not.toContain("cite-le précisément");
  });

  it("interdit les numéros inventés", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("N'invente jamais un numéro de page");
  });

  it("demande la cohérence d'un tour à l'autre", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("ne te contredis pas");
  });
});

/**
 * Un jury qui change de sujet à chaque réponse laisse passer tous les flous, et
 * ne crée jamais l'occasion de se contredire — alors que le critère 8 de la
 * grille note précisément « ne se contredit pas d'une réponse à l'autre ».
 */
describe("la façon dont le jury creuse", () => {
  it("autorise à insister jusqu'à trois fois sur un point resté vague", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("jusqu'à trois fois sur le même point");
    expect(p).toContain("On ne change de sujet que lorsque la réponse est nette");
  });

  it("fait revenir un autre membre sur un chiffre déjà donné", () => {
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("REVENIR SUR UN CHIFFRE");
    expect(p).toContain("un AUTRE membre y revient");
  });

  it("interdit d'annoncer que c'est une vérification", () => {
    // Prévenir le candidat annulerait l'exercice : un jury ne dit pas qu'il
    // recoupe, il recoupe.
    const p = construirePromptTour(base([]), 60);
    expect(p).toContain("sans dire que c'est une vérification");
  });
});

/**
 * La mémoire du jury : elle transforme des appels isolés en une relation.
 * Ces tests figent la conduite — rouvrir sur la question ratée, reconnaître
 * sobrement le progrès — pour qu'un remaniement de prompt ne l'efface pas.
 */
describe("le jury qui se souvient", () => {
  const souvenirs = [
    "Questions restées sans bonne réponse au dernier appel :",
    "- « Sur quel jeu de test ? » — une bonne réponse contenait : 12 000 sessions tenues à l'écart",
  ].join("\n");

  it("reçoit sa mémoire et la conduite qui va avec", () => {
    const p = construirePromptTour({ ...base([]), souvenirs }, 60);
    expect(p).toContain("TA MÉMOIRE DE CE CANDIDAT");
    expect(p).toContain("Sur quel jeu de test ?");
    expect(p).toContain("je vous repose la question");
  });

  it("ouvre sur la mémoire plutôt que sur l'angle tiré au sort", () => {
    const p = construirePromptTour({ ...base([]), souvenirs, graine: 3 }, 10);
    expect(p).toContain("Il ouvre sur la mémoire du candidat");
    expect(p).not.toContain("Angle imposé pour cette fois");
  });

  it("reconnaît le progrès sobrement, sans note ni compliment", () => {
    const p = construirePromptTour({ ...base([]), souvenirs }, 60);
    expect(p).toContain("Bien. Cette fois vous l'avez.");
    expect(p).toContain("Ne mentionne jamais de note");
  });

  it("garde l'angle tiré au sort pour un candidat jamais entendu", () => {
    const p = construirePromptTour(base([]), 10);
    expect(p).toContain("Angle imposé pour cette fois");
    expect(p).not.toContain("TA MÉMOIRE DE CE CANDIDAT");
  });
});
