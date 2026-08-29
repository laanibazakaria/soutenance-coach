import { describe, expect, it } from "vitest";
import { nettoyerTranscription } from "../../lib/transcription";

// Le cas réel du 29/08/2026 : l'appel de Zakaria sur son Samsung, où chaque
// silence devenait « Sous-titrage Société Radio-Canada » dans sa réponse.
describe("nettoyerTranscription", () => {
  it("efface la boucle « Sous-titrage Société Radio-Canada » du cas réel", () => {
    const brut = "Sous-titrage Société Radio-Canada Sous-titrage Société Radio-Canada Sous-titrage Société Radio-Canada Sous-titrage Société Radio-Canada";
    expect(nettoyerTranscription(brut)).toBe("");
  });

  it("garde la parole réelle au milieu des hallucinations", () => {
    const brut = "Sous-titrage Société Radio-Canada Ah, j'ai pas compris la question. S'il vous plaît, tu peux... Sous-titrage Société Radio-Canada";
    expect(nettoyerTranscription(brut)).toContain("j'ai pas compris la question");
    expect(nettoyerTranscription(brut)).not.toMatch(/sous-titrage/i);
    expect(nettoyerTranscription(brut)).not.toMatch(/radio-canada/i);
  });

  it("efface les remerciements de fin de vidéo, en français et en anglais", () => {
    expect(nettoyerTranscription("Merci d'avoir regardé cette vidéo !")).toBe("");
    expect(nettoyerTranscription("Thanks for watching!")).toBe("");
    expect(nettoyerTranscription("Sous-titres réalisés par la communauté d'Amara.org")).toBe("");
  });

  it("un « merci » seul est du bruit, mais une vraie phrase avec merci survit", () => {
    expect(nettoyerTranscription("Merci.")).toBe("");
    expect(nettoyerTranscription("Merci pour cette question, j'y ai réfléchi pendant le stage.")).toContain("j'y ai réfléchi");
  });

  it("ne touche pas à une réponse normale", () => {
    const brut = "Le scénario de perte concernait l'upload interrompu ; le test le rejoue en coupant le réseau.";
    expect(nettoyerTranscription(brut)).toBe(brut);
  });
});
