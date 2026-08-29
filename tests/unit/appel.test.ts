import { describe, expect, it } from "vitest";
import { assemblerContexte, construirePromptTour, construirePromptDebrief, parseTour, parseDebrief, validerHistorique, paroleCandidat, MEMBRES, LIMITES_APPEL } from "../../lib/appel";
import { DOSSIER_MAX } from "../../lib/appel/lecture";

const ctx = { mode: "soutenance" as const, contexte: "## Slides\nProjet de transcription audio, WER 12 %.", langue: "fr" as const, dureeMin: 10, historique: [] };

describe("appel avec le jury — contexte", () => {
  it("assemble les parties non vides et respecte la limite", () => {
    const c = assemblerContexte([{ titre: "A", texte: "x".repeat(5000) }, { titre: "B", texte: null }, { titre: "C", texte: "y".repeat(5000) }], 1000);
    expect(c).toContain("## A");
    expect(c).toContain("## C");
    expect(c).not.toContain("## B");
    expect(c.length).toBeLessThanOrEqual(1000 + 20);
    expect(assemblerContexte([{ titre: "A", texte: "court" }])).toBe("");
  });
});

describe("appel avec le jury — tours", () => {
  it("ouvre, continue, puis conclut selon le temps", () => {
    const debut = construirePromptTour(ctx, 0);
    expect(debut).toContain("tout début");
    expect(debut).toContain("Ne dis jamais"); // les formules toutes faites sont interdites, pas suggérées
    expect(debut).toContain("Le rapporteur");
    expect(debut).toContain("WER 12 %");
    expect(construirePromptTour({ ...ctx, historique: [{ role: "assistant", content: "q", membre: "rapporteur" }] }, 300)).toContain("Continue l’oral".replace("’", "'"));
    const fin = construirePromptTour(ctx, 580);
    expect(fin).toContain("C'est la fin");
    expect(fin).toContain('"fin"');
    expect(construirePromptTour({ ...ctx, contexte: "", langue: "en" }, 0)).toContain("Speak English");
  });

  it("parse une réplique, tolère les fences, borne la longueur", () => {
    expect(parseTour('{"replique": "Pourquoi le WER ?", "fin": false}')).toMatchObject({ replique: "Pourquoi le WER ?", fin: false });
    expect(parseTour('```json\n{"replique": "Merci, c\'est terminé.", "fin": true}\n```')?.fin).toBe(true);
    expect(parseTour('{"replique": ""}')).toBeNull();
    expect(parseTour("pas du json")).toBeNull();
    expect(parseTour(JSON.stringify({ replique: "a".repeat(900) }))!.replique.length).toBe(LIMITES_APPEL.repliqueChars);
  });

  it("nettoie l'historique : rôles valides, textes bornés, nombre borné", () => {
    const brut = [{ role: "assistant", content: " Q1 " }, { role: "system", content: "hack" }, { role: "user", content: "" }, { role: "user", content: "R1" }, 42, { role: "user" }];
    expect(validerHistorique(brut)).toEqual([{ role: "assistant", content: "Q1" }, { role: "user", content: "R1" }]);
    const long = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: `m${i}` }));
    expect(validerHistorique(long)).toHaveLength(LIMITES_APPEL.toursMax * 2);
    expect(validerHistorique("rien")).toEqual([]);
  });
});

describe("appel avec le jury — débrief", () => {
  const hist = [{ role: "assistant" as const, content: "Pourquoi le WER ?" }, { role: "user" as const, content: "Parce que c'est standard, euh, et mesurable." }];
  it("construit un prompt qui cite le dialogue et interdit la note", () => {
    const p = construirePromptDebrief(ctx, hist);
    expect(p).toContain("JURY DE SOUTENANCE : Pourquoi le WER ?");
    expect(p).toContain("CANDIDAT : Parce que");
    expect(p).toContain("ne note pas");
  });

  it("parse un débrief complet et ignore les entrées vides", () => {
    const d = parseDebrief(JSON.stringify({ diagnostic: "Solide sur la méthode, flou sur les limites.", bienFait: [{ point: "Métrique justifiée", citation: "c'est standard", pourquoi: "Tu as un argument." }, { point: "" }], momentsManques: [{ question: "Limites ?", ceQueTuAsDit: "rien", mieux: "Citer deux cas d'échec." }], planAction: ["Préparer 3 limites", ""], questionsPosees: ["Pourquoi le WER ?"] }));
    expect(d?.bienFait).toHaveLength(1);
    expect(d?.momentsManques[0]?.mieux).toBe("Citer deux cas d'échec.");
    expect(d?.planAction).toEqual(["Préparer 3 limites"]);
    expect(parseDebrief("{}")).toBeNull();
  });

  it("assemble la parole du candidat pour les mesures", () => {
    expect(paroleCandidat(hist)).toBe("Parce que c'est standard, euh, et mesurable.");
  });
});

describe("appel avec le jury — variété entre deux appels", () => {
  it("change d'ouvreur et d'angle selon la graine", () => {
    const vus = new Set<string>();
    for (let g = 0; g < 7; g++) {
      const p = construirePromptTour({ ...ctx, graine: g }, 0);
      const membre = /C'est « ([a-z]+) »/.exec(p)?.[1] ?? "";
      const angle = /Angle imposé pour cette fois : ([^.]+)\./.exec(p)?.[1] ?? "";
      expect(membre).not.toBe("");
      expect(angle).not.toBe("");
      vus.add(`${membre}|${angle}`);
    }
    // Sept graines, sept entrées en matière différentes.
    expect(vus.size).toBe(7);
  });

  it("interdit les formules de jury de théâtre et n'en souffle aucune", () => {
    const p = construirePromptTour({ ...ctx, graine: 3 }, 0);
    expect(p).toContain("Ne dis jamais");
    expect(p).toContain("Pas de préambule");
    expect(p).not.toContain("commence par : «");
  });

  it("annonce qui a parlé en dernier pour faire tourner la parole", () => {
    const p = construirePromptTour({ ...ctx, historique: [{ role: "assistant", content: "q", membre: "presidente" }, { role: "user", content: "r" }] }, 200);
    expect(p).toContain('« presidente »');
    expect(p).toContain("Fais tourner la parole");
  });

  it("transmet les questions déjà posées lors des appels précédents", () => {
    const p = construirePromptTour({ ...ctx, dejaPosees: ["Pourquoi le WER ?", "Combien de fichiers ?"] }, 0);
    expect(p).toContain("DÉJÀ POSÉ");
    expect(p).toContain("- Pourquoi le WER ?");
  });

  it("donne un membre valide même si le modèle en invente un", () => {
    expect(parseTour('{"replique":"Et le coût ?","membre":"martien"}', "soutenance")!.membre).toBe("rapporteur");
    expect(parseTour('{"replique":"Et le coût ?","membre":"presidente"}', "soutenance")!.membre).toBe("presidente");
    expect(parseTour('{"replique":"Et le coût ?"}', "entretien")!.membre).toBe("rh");
  });
});

/**
 * La répartition du budget de contexte. L'ancienne version partageait à parts
 * égales : un mémoire de cent pages était coupé pendant que dix diapositives
 * gaspillaient leur part. Le budget suit désormais le besoin.
 */
describe("assemblerContexte — le budget suit le besoin", () => {
  it("rend aux grandes sections ce que les petites n'utilisent pas", () => {
    const petit = "x".repeat(1_000);
    const gros = "y".repeat(50_000);
    const t = assemblerContexte([
      { titre: "Slides", texte: petit },
      { titre: "Mémoire", texte: gros },
    ], 30_000);
    // Le mémoire reçoit ~29 000 — pas 15 000 comme avec le partage égal.
    expect((t.match(/y/g) ?? []).length).toBeGreaterThan(28_000);
    expect((t.match(/x/g) ?? []).length).toBe(1_000);
  });

  it("reste équitable quand tout le monde est affamé", () => {
    const a = "a".repeat(50_000);
    const b = "b".repeat(50_000);
    const t = assemblerContexte([{ titre: "A", texte: a }, { titre: "B", texte: b }], 20_000);
    const na = (t.match(/a/g) ?? []).length;
    const nb = (t.match(/b/g) ?? []).length;
    expect(Math.abs(na - nb)).toBeLessThan(10);
    expect(na + nb).toBeLessThanOrEqual(20_000);
  });

  it("un mémoire de cent pages tient entier dans le dossier de lecture", () => {
    // 200 000 signes = la limite du dépôt ; DOSSIER_MAX doit les absorber
    // aux côtés des slides et des notes du rapporteur.
    const memoire = "q".repeat(200_000);
    const t = assemblerContexte([
      { titre: "Diapositives", texte: "s".repeat(15_000) },
      { titre: "Mémoire", texte: memoire },
      { titre: "Notes", texte: "n".repeat(2_000) },
    ], DOSSIER_MAX);
    expect((t.match(/q/g) ?? []).length).toBe(200_000);
  });
});

describe("le jury de soutenance à quatre", () => {
  it("compte l'examinatrice externe, avec le timbre encore libre", () => {
    const s = MEMBRES.soutenance;
    expect(s).toHaveLength(4);
    const ex = s.find((m) => m.id === "examinatrice")!;
    expect(ex.voix).toBe("vive");
    expect(ex.obsession).toContain("filière");
    // Quatre timbres distincts : chaque membre garde sa voix.
    expect(new Set(s.map((m) => m.voix)).size).toBe(4);
  });
});

// ── Le test grandeur nature du 29/08/2026 (simulation de 15 min sur un vrai
//    dossier) : rapporteur 8 tours sur 12, présidente muette, et des questions
//    encore posées une minute après la fin. Ces verrous l'empêchent de revenir.
import { finImposee } from "@/lib/appel";

describe("rotation imposée et fin d'appel", () => {
  const membreDe = (mode: "soutenance" | "entretien") => MEMBRES[mode][1]!.id;

  it("après 3 questions d'affilée du même membre, la consigne devient impérative et nominative", () => {
    const membre = membreDe("soutenance");
    const historique = [
      { role: "assistant" as const, content: "Q1 ?", membre },
      { role: "user" as const, content: "R1." },
      { role: "assistant" as const, content: "Q2 ?", membre },
      { role: "user" as const, content: "R2." },
      { role: "assistant" as const, content: "Q3 ?", membre },
      { role: "user" as const, content: "R3." },
    ];
    const p = construirePromptTour({ mode: "soutenance", contexte: "x", langue: "fr", dureeMin: 15, historique }, 300);
    expect(p).toContain("IMPÉRATIF");
    expect(p).toContain(`ne peut PAS être « ${membre} »`);
    expect(p).toContain("N'ont pas encore dit un mot");
  });

  it("à deux questions d'affilée, pas d'impératif : la relance légitime reste possible", () => {
    const membre = membreDe("soutenance");
    const historique = [
      { role: "assistant" as const, content: "Q1 ?", membre },
      { role: "user" as const, content: "R1." },
      { role: "assistant" as const, content: "Q2 ?", membre },
      { role: "user" as const, content: "R2." },
    ];
    const p = construirePromptTour({ mode: "soutenance", contexte: "x", langue: "fr", dureeMin: 15, historique }, 300);
    expect(p).not.toContain("IMPÉRATIF");
  });

  it("la conclusion interdit toute nouvelle question et désigne qui parle", () => {
    const p = construirePromptTour({ mode: "soutenance", contexte: "x", langue: "fr", dureeMin: 15, historique: [{ role: "assistant", content: "Q ?", membre: membreDe("soutenance") }, { role: "user", content: "R." }] }, 15 * 60 - 10);
    expect(p).toContain("AUCUNE nouvelle question");
    expect(p).toContain(`« ${MEMBRES.soutenance[0]!.id} »`);
  });

  it("passé 45 s au-delà du temps, le code impose la fin — jamais avant", () => {
    expect(finImposee(15, 15 * 60 + 45)).toBe(true);
    expect(finImposee(15, 15 * 60 + 30)).toBe(false);
    expect(finImposee(15, 300)).toBe(false);
  });
});

// Même l'interdit nominatif dans le prompt a été ignoré au test du 29/08 :
// la route retire donc la parole elle-même.
import { membreDeRemplacement } from "@/lib/appel";

describe("la parole retirée par le code", () => {
  const rap = MEMBRES.soutenance[1]!.id;
  const hist3 = [
    { role: "assistant" as const, content: "Q1 ?", membre: rap },
    { role: "user" as const, content: "R1." },
    { role: "assistant" as const, content: "Q2 ?", membre: rap },
    { role: "user" as const, content: "R2." },
    { role: "assistant" as const, content: "Q3 ?", membre: rap },
    { role: "user" as const, content: "R3." },
  ];

  it("au 4e tour du même membre, un membre muet prend la parole", () => {
    const r = membreDeRemplacement(hist3, "soutenance", rap);
    expect(r).not.toBeNull();
    expect(r).not.toBe(rap);
    expect(MEMBRES.soutenance.some((m) => m.id === r)).toBe(true);
  });

  it("si le modèle change de lui-même, on ne touche à rien", () => {
    expect(membreDeRemplacement(hist3, "soutenance", MEMBRES.soutenance[0]!.id)).toBeNull();
  });

  it("à moins de trois tours d'affilée, on ne touche à rien", () => {
    expect(membreDeRemplacement(hist3.slice(2), "soutenance", rap)).toBeNull();
  });
});
