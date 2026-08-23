import { describe, it, expect } from "vitest";
import { mesurerAudio, seuilSilence, constatsAudio, SEUILS_AUDIO } from "../../lib/audio/mesures";

/** Une courbe d'intensité : des segments (valeur, durée en pas de 100 ms). */
const courbe = (segments: [number, number][]): number[] => segments.flatMap(([v, n]) => Array.from({ length: n }, () => v));

describe("mesures audio", () => {
  it("trop court : pas de mesure", () => {
    expect(mesurerAudio([0.1, 0.1], 100)).toBeNull();
  });

  it("compte les blancs longs et ignore le silence du début et de la fin", () => {
    const rms = courbe([
      [0.001, 20], // silence initial : ignoré
      [0.2, 30],
      [0.001, 20], // 2 s de blanc → long
      [0.18, 30],
      [0.001, 5], // 0,5 s : court
      [0.22, 30],
      [0.001, 30], // silence final : ignoré
    ]);
    const m = mesurerAudio(rms, 100)!;
    expect(m.pausesLongues).toBe(1);
    expect(m.plusLonguePauseMs).toBe(2000);
    expect(m.partSilence).toBeCloseTo(25 / 115, 2);
    expect(m.dynamique).toBeGreaterThan(0);
  });

  it("le seuil s'adapte au bruit de fond", () => {
    const calme = courbe([[0.001, 50], [0.2, 50]]);
    const bruyant = courbe([[0.05, 50], [0.3, 50]]);
    expect(seuilSilence(bruyant)).toBeGreaterThan(seuilSilence(calme));
    expect(seuilSilence([])).toBe(0);
  });

  it("une voix plate est signalée comme monotone, une voix qui varie non", () => {
    const plate = constatsAudio({ pausesLongues: 0, plusLonguePauseMs: 0, partSilence: 0.05, dynamique: 0.1 });
    expect(plate.find((c) => c.id === "dynamique")?.niveau).toBe("attention");
    const vivante = constatsAudio({ pausesLongues: 2, plusLonguePauseMs: 2200, partSilence: 0.1, dynamique: 0.45 });
    expect(vivante.find((c) => c.id === "dynamique")?.niveau).toBe("bon");
    expect(vivante.find((c) => c.id === "pauses")?.message).toContain("2 blancs");
  });

  it("trop de silence est signalé", () => {
    const c = constatsAudio({ pausesLongues: 6, plusLonguePauseMs: 4000, partSilence: SEUILS_AUDIO.partSilenceElevee + 0.1, dynamique: 0.4 });
    expect(c.find((x) => x.id === "pauses")?.niveau).toBe("attention");
  });
});
