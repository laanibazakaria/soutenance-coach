import { describe, expect, it, beforeEach } from "vitest";
import { creerOral, basculerSurOral, listeOraux, oralActif, renommerOral, supprimerOral, adopterEspaceExistant } from "../../lib/oraux";

// Les oraux : des dossiers nommés qui ne se marchent pas dessus. Chaque test
// vérifie la promesse centrale — rien ne fuit d'un oral à l'autre, rien ne
// se perd en basculant.

function fauxStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as Storage;
}

describe("les oraux", () => {
  let st: Storage;
  beforeEach(() => {
    st = fauxStorage();
  });

  it("créer un oral demande un nom et le garde", () => {
    const o = creerOral(st, "  PFE 2026  ", "soutenance");
    expect(o.nom).toBe("PFE 2026");
    expect(oralActif(st)?.id).toBe(o.id);
    expect(listeOraux(st)).toHaveLength(1);
  });

  it("rien ne fuit d'un oral à l'autre : le mémoire de A est invisible chez B", () => {
    creerOral(st, "PFE", "soutenance");
    st.setItem("sc.ia.v1:rapport:texte", "le mémoire de A");
    st.setItem("sc.deck.v1", "les slides de A");
    const b = creerOral(st, "GELCO", "entretien");
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBeNull();
    expect(st.getItem("sc.deck.v1")).toBeNull();
    st.setItem("sc.candidature.v1", "le CV chez B");
    expect(oralActif(st)?.id).toBe(b.id);
  });

  it("basculer rend TOUT : documents, appels, sessions", () => {
    const a = creerOral(st, "PFE", "soutenance");
    st.setItem("sc.ia.v1:rapport:texte", "mémoire A");
    st.setItem("sc.ia.v1:appel:123", "appel de A");
    st.setItem("sc.sessions.v1", "sessions de A");
    const b = creerOral(st, "GELCO", "entretien");
    st.setItem("sc.candidature.v1", "CV B");
    expect(basculerSurOral(st, a.id)).toBe(true);
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBe("mémoire A");
    expect(st.getItem("sc.ia.v1:appel:123")).toBe("appel de A");
    expect(st.getItem("sc.sessions.v1")).toBe("sessions de A");
    expect(st.getItem("sc.candidature.v1")).toBeNull();
    expect(basculerSurOral(st, b.id)).toBe(true);
    expect(st.getItem("sc.candidature.v1")).toBe("CV B");
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBeNull();
  });

  it("le type du dossier pose la préférence de module — l'app entière suit", () => {
    creerOral(st, "GELCO", "entretien");
    expect(st.getItem("sc.ia.v1:preferences:modules")).toContain("entretien");
  });

  it("supprimer l'oral actif réveille le plus récent des restants", () => {
    const a = creerOral(st, "A", "soutenance");
    st.setItem("sc.deck.v1", "deck A");
    const b = creerOral(st, "B", "entretien");
    st.setItem("sc.candidature.v1", "CV B");
    supprimerOral(st, b.id);
    expect(oralActif(st)?.id).toBe(a.id);
    expect(st.getItem("sc.deck.v1")).toBe("deck A");
    expect(st.getItem("sc.candidature.v1")).toBeNull();
    expect(listeOraux(st)).toHaveLength(1);
  });

  it("supprimer un oral endormi efface son archive sans toucher l'actif", () => {
    const a = creerOral(st, "A", "soutenance");
    st.setItem("sc.deck.v1", "deck A");
    creerOral(st, "B", "entretien");
    st.setItem("sc.candidature.v1", "CV B");
    supprimerOral(st, a.id);
    expect(st.getItem("sc.candidature.v1")).toBe("CV B");
    expect(st.getItem(`sc.oral.v1:${a.id}`)).toBeNull();
  });

  it("renommer", () => {
    const o = creerOral(st, "Brouillon", "soutenance");
    renommerOral(st, o.id, "PFE — IA médicale");
    expect(listeOraux(st)[0]!.nom).toBe("PFE — IA médicale");
  });

  it("l'héritage mélangé est DÉCOUPÉ en deux dossiers dormants, l'espace actif reste vide", () => {
    st.setItem("sc.ia.v1:rapport:texte", "mémoire existant");
    st.setItem("sc.candidature.v1", "candidature GELCO");
    st.setItem("sc.ia.v1:appel:aaa", JSON.stringify({ donnee: { mode: "soutenance", dialogue: [] } }));
    st.setItem("sc.ia.v1:appel:bbb", JSON.stringify({ donnee: { mode: "entretien", dialogue: [] } }));
    st.setItem("sc.sessions.v1", JSON.stringify([{ id: "s1" }, { id: "s2", mode: "entretien" }]));

    const crees = adopterEspaceExistant(st);
    expect(crees).toHaveLength(2);
    expect(crees!.map((o) => o.type).sort()).toEqual(["entretien", "soutenance"]);

    // On entre dans une pièce rangée : rien d'actif, rien de pré-rempli.
    expect(oralActif(st)).toBeNull();
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBeNull();
    expect(st.getItem("sc.candidature.v1")).toBeNull();
    expect(st.getItem("sc.sessions.v1")).toBeNull();

    // Rouvrir « Ma soutenance » : ses affaires, et seulement les siennes.
    const sout = crees!.find((o) => o.type === "soutenance")!;
    basculerSurOral(st, sout.id);
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBe("mémoire existant");
    expect(st.getItem("sc.ia.v1:appel:aaa")).not.toBeNull();
    expect(st.getItem("sc.ia.v1:appel:bbb")).toBeNull();
    expect(st.getItem("sc.candidature.v1")).toBeNull();
    expect(JSON.parse(st.getItem("sc.sessions.v1")!)).toHaveLength(1);

    // Rouvrir « Mon entretien » : l'appel GELCO et sa session, rien d'autre.
    const entr = crees!.find((o) => o.type === "entretien")!;
    basculerSurOral(st, entr.id);
    expect(st.getItem("sc.candidature.v1")).toBe("candidature GELCO");
    expect(st.getItem("sc.ia.v1:appel:bbb")).not.toBeNull();
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBeNull();
    const sessions = JSON.parse(st.getItem("sc.sessions.v1")!) as Array<{ mode?: string }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.mode).toBe("entretien");
  });

  it("un héritage d'un seul type ne crée qu'un dossier", () => {
    st.setItem("sc.ia.v1:rapport:texte", "mémoire seul");
    const crees = adopterEspaceExistant(st);
    expect(crees).toHaveLength(1);
    expect(crees![0]!.type).toBe("soutenance");
    // et l'adoption ne se refait pas
    expect(adopterEspaceExistant(st)).toBeNull();
  });

  it("un appareil vierge n'adopte rien", () => {
    expect(adopterEspaceExistant(st)).toBeNull();
  });
});

// La première adoption (avant le découpage) laissait un dossier unique
// mélangé et actif — la réparation le re-découpe.
import { reparerHeritageMelange } from "../../lib/oraux";

describe("réparation de l'héritage mélangé", () => {
  it("un dossier d'adoption qui mélange les deux types est re-découpé", () => {
    const st = fauxStorage();
    st.setItem("sc.ia.v1:rapport:texte", "mémoire");
    st.setItem("sc.candidature.v1", "candidature");
    // l'ancienne adoption : un seul dossier, actif, tout dedans
    st.setItem("sc.oraux.v1", JSON.stringify({ actif: "x", liste: [{ id: "x", nom: "Ma soutenance", type: "soutenance", creeLe: "2026-08-29", vuLe: "2026-08-29" }] }));
    reparerHeritageMelange(st);
    const liste = listeOraux(st);
    expect(liste).toHaveLength(2);
    expect(oralActif(st)).toBeNull();
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBeNull();
  });

  it("un dossier renommé par l'utilisateur n'est jamais touché", () => {
    const st = fauxStorage();
    st.setItem("sc.ia.v1:rapport:texte", "mémoire");
    st.setItem("sc.candidature.v1", "candidature");
    st.setItem("sc.oraux.v1", JSON.stringify({ actif: "x", liste: [{ id: "x", nom: "PFA — IA", type: "soutenance", creeLe: "2026-08-29", vuLe: "2026-08-29" }] }));
    reparerHeritageMelange(st);
    expect(listeOraux(st)).toHaveLength(1);
    expect(oralActif(st)?.nom).toBe("PFA — IA");
  });
});

// La synchronisation de compte re-remplissait un dossier vide avec le
// travail du cloud (vu en vrai : « ffd » vide affichant 43 pages). Le monde
// des oraux voyage désormais entier, et l'espace actif de CET appareil reste
// la vérité.
import { fusionnerMondeOraux, instantaneEspace, archiveBrute, fermerOralActif } from "../../lib/oraux";

describe("fusion du monde des oraux (synchronisation)", () => {
  it("un oral inconnu arrive du compte avec son archive, sans toucher l'espace actif", () => {
    const st = fauxStorage();
    const local = creerOral(st, "Local", "soutenance");
    st.setItem("sc.deck.v1", "deck local");
    const registreDistant = JSON.stringify({ actif: null, liste: [
      { id: "zzz", nom: "Venu du cloud", type: "entretien", creeLe: "2026-08-28", vuLe: "2026-08-28" },
    ] });
    fusionnerMondeOraux(st, registreDistant, { zzz: JSON.stringify({ "sc.candidature.v1": "CV cloud" }) });
    expect(listeOraux(st)).toHaveLength(2);
    expect(oralActif(st)?.id).toBe(local.id);
    // l'espace actif n'a PAS été pollué
    expect(st.getItem("sc.candidature.v1")).toBeNull();
    expect(st.getItem("sc.deck.v1")).toBe("deck local");
    // l'oral du cloud dort avec son archive
    expect(archiveBrute(st, "zzz")).toContain("CV cloud");
  });

  it("deux migrations du même travail (noms identiques, ids différents) ne font pas doublon", () => {
    const st = fauxStorage();
    st.setItem("sc.oraux.v1", JSON.stringify({ actif: null, liste: [
      { id: "ici", nom: "Ma soutenance", type: "soutenance", creeLe: "2026-08-29", vuLe: "2026-08-29" },
    ] }));
    st.setItem("sc.oral.v1:ici", JSON.stringify({ "sc.deck.v1": "deck d'ici" }));
    const registreDistant = JSON.stringify({ actif: null, liste: [
      { id: "labas", nom: "Ma soutenance", type: "soutenance", creeLe: "2026-08-29", vuLe: "2026-08-30" },
    ] });
    fusionnerMondeOraux(st, registreDistant, { labas: JSON.stringify({ "sc.deck.v1": "deck de là-bas" }) });
    const liste = listeOraux(st);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.id).toBe("labas"); // le plus récemment vu gagne
    expect(archiveBrute(st, "ici")).toBeNull();
  });

  it("l'instantané de l'espace vif ne le vide pas", () => {
    const st = fauxStorage();
    creerOral(st, "X", "soutenance");
    st.setItem("sc.deck.v1", "deck");
    const inst = instantaneEspace(st);
    expect(inst["sc.deck.v1"]).toBe("deck");
    expect(st.getItem("sc.deck.v1")).toBe("deck");
  });
});

describe("fermer le dossier actif (le bureau du matin)", () => {
  it("range l'espace vif dans l'archive et vide l'entrée", () => {
    const st = fauxStorage();
    const o = creerOral(st, "PFA", "soutenance");
    st.setItem("sc.ia.v1:rapport:texte", "mémoire");
    expect(fermerOralActif(st)).toBe(true);
    expect(oralActif(st)).toBeNull();
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBeNull();
    // et tout revient quand on rouvre
    basculerSurOral(st, o.id);
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBe("mémoire");
  });

  it("sans dossier actif, ne fait rien", () => {
    const st = fauxStorage();
    expect(fermerOralActif(st)).toBe(false);
  });
});
