import { describe, it, expect } from "vitest";
import {
  construirePromptQuestions,
  parseQuestionsGenerees,
  formaterDeckPourModele,
} from "../../lib/jury/generation";
import { construirePromptPitch, parsePitch, pitchEnTexte } from "../../lib/pitch";
import { empreinte, cleCache, lireCache, ecrireCache } from "../../lib/ia-cache";
import { decouperSlide } from "../../lib/slides/analyse";
import type { Deck } from "../../lib/slides/types";
import type { StorageLike } from "../../lib/types";

function deckDe(pages: string[]): Deck {
  return { nomFichier: "p.pdf", slides: pages.map((p, i) => decouperSlide(i + 1, p)) };
}

const deck = deckDe([
  "SoutenanceCoach\nCoach d'oral pour étudiants",
  "Architecture\nNext.js, transcription Web Speech API, scoring déterministe",
  "Résultats\n142 tests automatisés, 0 perte de données",
]);

describe("formaterDeckPourModele", () => {
  it("numérote et titre chaque diapositive", () => {
    const t = formaterDeckPourModele(deck);
    expect(t).toContain("[Diapositive 1] SoutenanceCoach");
    expect(t).toContain("[Diapositive 3] Résultats");
  });

  it("tronque un support énorme pour tenir dans le budget", () => {
    const enorme = deckDe(Array(60).fill("Titre\n" + "mot ".repeat(800)));
    expect(formaterDeckPourModele(enorme).length).toBeLessThanOrEqual(9100);
  });
});

describe("construirePromptQuestions — garde-fous dans la consigne", () => {
  const p = construirePromptQuestions(deck, { nombre: 8, dureeMinutes: 15 });

  it("exige des questions spécifiques au support et interdit les génériques", () => {
    expect(p).toContain("SPÉCIFIQUE");
    expect(p).toContain("interdite");
  });

  it("transmet le contenu réel des diapositives", () => {
    expect(p).toContain("Web Speech API");
    expect(p).toContain("142 tests");
  });

  it("demande le nombre et la durée", () => {
    expect(p).toContain("exactement 8 questions");
    expect(p).toContain("15 minutes");
  });

  it("interdit toute note chiffrée", () => {
    expect(p).toContain("Aucune note");
  });
});

describe("parseQuestionsGenerees", () => {
  const valides = [
    { question: "Pourquoi la Web Speech API plutôt que Whisper ?", pourquoi: "Vérifier le choix.", categorie: "technique", slide: 2 },
    { question: "Comment vos 142 tests couvrent-ils le bruit de transcription ?", pourquoi: "Tester la rigueur.", categorie: "methode", slide: 3 },
    { question: "Que se passe-t-il hors Chrome ?", pourquoi: "Cerner les limites.", categorie: "limites", slide: 2 },
  ];

  it("tableau nu valide → questions avec ids stables", () => {
    const q = parseQuestionsGenerees(JSON.stringify(valides), 3);
    expect(q).toHaveLength(3);
    expect(q?.[0].id).toBe("ia-0");
    expect(q?.[0].slide).toBe(2);
  });

  it("objet { questions: [...] } accepté aussi", () => {
    expect(parseQuestionsGenerees(JSON.stringify({ questions: valides }), 3)).toHaveLength(3);
  });

  it("JSON entouré de texte → extrait", () => {
    const brut = "Voici :\n```json\n" + JSON.stringify(valides) + "\n```";
    expect(parseQuestionsGenerees(brut, 3)).toHaveLength(3);
  });

  it("catégorie inconnue → repli « technique » ; slide hors support → ignoré", () => {
    const q = parseQuestionsGenerees(
      JSON.stringify([...valides, { question: "Une question assez longue ici ?", pourquoi: "x", categorie: "bizarre", slide: 99 }]),
      3,
    );
    expect(q?.[3].categorie).toBe("technique");
    expect(q?.[3].slide).toBeUndefined();
  });

  it("doublons et entrées incomplètes écartés", () => {
    const q = parseQuestionsGenerees(
      JSON.stringify([...valides, valides[0], { question: "court", pourquoi: "x" }, { pourquoi: "sans question" }]),
      3,
    );
    expect(q).toHaveLength(3);
  });

  it("moins de trois questions exploitables → null (pas de liste squelettique)", () => {
    expect(parseQuestionsGenerees(JSON.stringify(valides.slice(0, 2)), 3)).toBeNull();
  });

  it("texte sans JSON → null", () => {
    expect(parseQuestionsGenerees("Je ne peux pas.", 3)).toBeNull();
  });
});

describe("construirePromptPitch", () => {
  it("fixe la durée en secondes et exige une entrée par diapositive", () => {
    const p = construirePromptPitch(deck, 15);
    expect(p).toContain("900 secondes");
    expect(p).toContain("Une entrée par diapositive");
    expect(p).toContain("Il ne lit PAS la diapositive");
  });
});

describe("parsePitch", () => {
  const brut = {
    accroche: "Imaginez un étudiant seul devant son miroir.",
    slides: [
      { numero: 1, messageCle: "Le problème", texte: "Je commence par le problème.", transition: "Voyons comment.", secondes: 60 },
      { numero: 2, messageCle: "La solution", texte: "Voici l'architecture.", transition: "Et les résultats ?", secondes: 120 },
      { numero: 3, messageCle: "La preuve", texte: "142 tests.", transition: "", secondes: 60 },
    ],
    conclusion: "Ce projet transforme l'entraînement en mesure.",
    conseils: ["Ralentis sur la 2", "Appuie le 142", "Souris"],
  };

  it("pitch valide → structure restituée, triée par numéro", () => {
    const p = parsePitch(JSON.stringify({ ...brut, slides: [...brut.slides].reverse() }), 3, 4);
    expect(p?.slides.map((s) => s.numero)).toEqual([1, 2, 3]);
    expect(p?.conseils).toHaveLength(3);
  });

  it("minutage hors cible de plus de 15 % → renormalisé vers la cible", () => {
    // 240 s proposées pour 10 min (600 s) → facteur 2.5
    const p = parsePitch(JSON.stringify(brut), 3, 10);
    const somme = p!.slides.reduce((n, s) => n + s.secondes, 0);
    expect(Math.abs(somme - 600)).toBeLessThanOrEqual(5);
  });

  it("minutage proche de la cible → conservé tel quel", () => {
    const p = parsePitch(JSON.stringify(brut), 3, 4); // 240 s pour 240 s
    expect(p?.slides.map((s) => s.secondes)).toEqual([60, 120, 60]);
  });

  it("diapositive hors support ou sans texte → ignorée, sans inventer", () => {
    const p = parsePitch(
      JSON.stringify({ ...brut, slides: [...brut.slides, { numero: 9, texte: "x", secondes: 10 }, { numero: 2, texte: "", secondes: 10 }] }),
      3,
      4,
    );
    expect(p?.slides).toHaveLength(3);
  });

  it("accroche ou conclusion manquante → null", () => {
    expect(parsePitch(JSON.stringify({ slides: brut.slides }), 3, 4)).toBeNull();
  });

  it("pitchEnTexte produit un script lisible avec titres et minutage", () => {
    const p = parsePitch(JSON.stringify(brut), 3, 4)!;
    const t = pitchEnTexte(p, deck);
    expect(t).toContain("ACCROCHE");
    expect(t).toContain("Diapositive 2 — Architecture (120 s)");
    expect(t).toContain("CONSEILS DE LIVRAISON");
  });
});

describe("ia-cache", () => {
  const mem = (): StorageLike => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };

  it("empreinte déterministe et sensible au contenu", () => {
    expect(empreinte("abc")).toBe(empreinte("abc"));
    expect(empreinte("abc")).not.toBe(empreinte("abd"));
  });

  it("la clé change avec les paramètres", () => {
    expect(cleCache("q", ["a"], "15")).not.toBe(cleCache("q", ["a"], "20"));
  });

  it("aller-retour lecture/écriture, et corruption tolérée", () => {
    const s = mem();
    ecrireCache(s, "k", { x: 1 });
    expect(lireCache<{ x: number }>(s, "k")).toEqual({ x: 1 });
    s.setItem("sc.ia.v1:corrompu", "{pas du json");
    expect(lireCache(s, "corrompu")).toBeNull();
  });
});
