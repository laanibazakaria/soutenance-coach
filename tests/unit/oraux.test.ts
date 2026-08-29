import { describe, expect, it, beforeEach } from "vitest";
import { creerOral, basculerSurOral, listeOraux, oralActif, renommerOral, supprimerOral, adopterEspaceExistant, typeDevine } from "../../lib/oraux";

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

  it("un appareil d'avant les oraux est adopté tel quel, sans rien perdre", () => {
    st.setItem("sc.ia.v1:rapport:texte", "mémoire existant");
    st.setItem("sc.sessions.v1", "sessions existantes");
    const o = adopterEspaceExistant(st);
    expect(o?.type).toBe("soutenance");
    expect(oralActif(st)?.id).toBe(o!.id);
    // rien n'a été gelé : le travail est toujours en place
    expect(st.getItem("sc.ia.v1:rapport:texte")).toBe("mémoire existant");
    // et l'adoption ne se refait pas
    expect(adopterEspaceExistant(st)).toBeNull();
  });

  it("un appareil vierge n'adopte rien", () => {
    expect(adopterEspaceExistant(st)).toBeNull();
    expect(typeDevine(st)).toBe("soutenance");
  });
});
