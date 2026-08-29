import { describe, expect, it } from "vitest";
import { extraireLexique, formaterLexique } from "../../lib/lexique";

// Le lexique soufflé à Whisper : les mots du dossier qu'une transcription
// aveugle écorche — sigles, noms propres, termes à chiffre.
describe("extraireLexique", () => {
  const memoire = `Rapport de stage chez Propulsez. Propulsez développe Coach IA.
    Le module RAG interroge les documents. Le RAG est central. Mission PFE : PFE
    validé par l'ENSIAS. L'ENSIAS exige un mémoire. Whisper transcrit ;
    Whisper hallucine parfois. Le serveur Vercel déploie ; Vercel journalise.
    Nous avons choisi Node.js et Node.js encore. La suite gpt-4 puis gpt-4.
    Le test vérifie. Le test revient. Introduction et Conclusion classiques.`;

  it("retient les sigles vus plusieurs fois", () => {
    const l = extraireLexique(memoire);
    expect(l).toContain("RAG");
    expect(l).toContain("PFE");
    expect(l).toContain("ENSIAS");
  });

  it("retient les noms propres répétés, pas les débuts de phrase", () => {
    const l = extraireLexique(memoire);
    expect(l).toContain("Propulsez");
    expect(l).toContain("Whisper");
    expect(l).toContain("Vercel");
    // « Le » ouvre des phrases ; « test » vit en minuscules : ni l'un ni l'autre.
    expect(l).not.toContain("Le");
    expect(l).not.toContain("test");
  });

  it("retient les termes à chiffre ou à point interne", () => {
    const l = extraireLexique(memoire);
    expect(l).toContain("Node.js");
    expect(l).toContain("gpt-4");
  });

  it("écarte les mots de structure d'un mémoire", () => {
    const l = extraireLexique(memoire);
    expect(l).not.toContain("Introduction");
    expect(l).not.toContain("Conclusion");
    expect(l).not.toContain("Mission");
  });

  it("borne la ligne pour le prompt", () => {
    const longs = Array.from({ length: 80 }, (_, i) => `TermeTechnique${i}`);
    expect(formaterLexique(longs).length).toBeLessThanOrEqual(450);
    expect(formaterLexique([])).toBe("");
  });
});
