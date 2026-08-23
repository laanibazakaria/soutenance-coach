import { describe, expect, it } from "vitest";
import { interpreter, analyserImages, constats, ligneContexteCamera, SEUILS_CAMERA, type ImageVisage } from "../../lib/camera";

/** Fabrique une suite d'images à 5 images/seconde. */
function suite(n: number, gabarit: (i: number) => Partial<ImageVisage>): ImageVisage[] {
  return Array.from({ length: n }, (_, i) => ({ tMs: i * 200, visage: true, lacetDeg: 0, tangageDeg: 0, regardHorizontal: 0, regardVertical: 0, sourire: 0, ...gabarit(i) }));
}

describe("caméra — interprétation d'une image", () => {
  it("regarde le jury quand la tête et les yeux sont dans l'axe", () => {
    expect(interpreter({ tMs: 0, visage: true, lacetDeg: 8, tangageDeg: 5, regardHorizontal: 0.1 }).versJury).toBe(true);
  });

  it("ne regarde plus dès qu'un seul signal dépasse", () => {
    expect(interpreter({ tMs: 0, visage: true, lacetDeg: SEUILS_CAMERA.lacetDeg + 1 }).versJury).toBe(false);
    expect(interpreter({ tMs: 0, visage: true, tangageDeg: -30 }).versJury).toBe(false);
    expect(interpreter({ tMs: 0, visage: true, regardHorizontal: -0.9 }).versJury).toBe(false);
    expect(interpreter({ tMs: 0, visage: false }).versJury).toBe(false);
  });
});

describe("caméra — bilan d'un oral", () => {
  it("refuse de conclure sous 60 images", () => {
    const b = analyserImages(suite(30, () => ({})));
    expect(b.exploitable).toBe(false);
    expect(constats(b)).toHaveLength(1);
    expect(constats(b)[0]!.niveau).toBe("absent");
    expect(ligneContexteCamera(b)).toBeNull();
    expect(analyserImages([]).images).toBe(0);
  });

  it("compte la part de regard, les sourires et la durée", () => {
    // 100 images : les 30 premières la tête tournée, puis 70 dans l'axe ; sourire une image sur deux.
    const b = analyserImages(suite(100, (i) => ({ lacetDeg: i < 30 ? 40 : 3, sourire: i % 2 === 0 ? 0.5 : 0 })));
    expect(b.exploitable).toBe(true);
    expect(b.partVersJury).toBe(70);
    expect(b.partSourire).toBe(50);
    expect(b.dureeMs).toBe(99 * 200);
    expect(b.partHorsCadre).toBe(0);
  });

  it("repère les décrochages de plus de 2,5 s, y compris à la fin", () => {
    // 6 s de côté (30 images), puis 10 s de face, puis 4 s de côté jusqu'à la fin.
    const b = analyserImages(suite(120, (i) => ({ lacetDeg: i < 30 || i >= 100 ? 45 : 2 })));
    expect(b.decrochages).toHaveLength(2);
    expect(b.decrochages[0]!.debutMs).toBe(0);
    expect(b.decrochages[0]!.dureeMs).toBe(6000);
    expect(b.decrochages[1]!.debutMs).toBe(100 * 200);
    const c = constats(b).find((x) => x.label === "Décrochages");
    expect(c?.valeur).toBe("2");
    expect(c?.phrase).toContain("Le plus long");
  });

  it("ignore les brèves absences de regard", () => {
    // Une image sur dix détournée : jamais 2,5 s d'affilée.
    const b = analyserImages(suite(100, (i) => ({ lacetDeg: i % 10 === 0 ? 40 : 2 })));
    expect(b.decrochages).toHaveLength(0);
    expect(b.partVersJury).toBe(90);
  });

  it("signale un visage qui sort du cadre", () => {
    const b = analyserImages(suite(100, (i) => ({ visage: i >= 75 ? false : true, lacetDeg: 2 })));
    expect(b.partHorsCadre).toBe(25);
    const c = constats(b).find((x) => x.label === "Hors cadre");
    expect(c?.niveau).toBe("alerte");
  });

  it("mesure la stabilité de la tête par la dispersion du lacet", () => {
    const pose = analyserImages(suite(100, () => ({ lacetDeg: 2 })));
    expect(pose.stabiliteDeg).toBe(0);
    expect(constats(pose).find((x) => x.label === "Tenue de tête")?.niveau).toBe("bon");
    const agite = analyserImages(suite(100, (i) => ({ lacetDeg: i % 2 === 0 ? -20 : 20 })));
    expect(agite.stabiliteDeg).toBe(20);
    expect(constats(agite).find((x) => x.label === "Tenue de tête")?.niveau).toBe("attention");
  });

  it("écrit des constats sans note et une ligne pour le coach", () => {
    const b = analyserImages(suite(100, (i) => ({ lacetDeg: i < 60 ? 40 : 2 })));
    const c = constats(b);
    const regard = c.find((x) => x.id === "regard")!;
    expect(regard.valeur).toBe("40 %");
    expect(regard.niveau).toBe("alerte");
    expect(c.every((x) => !/\/10|note|score/i.test(x.phrase))).toBe(true);
    expect(ligneContexteCamera(b)).toContain("regard vers le jury 40 %");
    expect(ligneContexteCamera(null)).toBeNull();
  });
});

describe("caméra — quand le visage n'est jamais vu", () => {
  it("ne juge ni le sourire ni la tenue de tête", () => {
    const images = Array.from({ length: 100 }, (_, i) => ({ tMs: i * 200, visage: false }));
    const b = analyserImages(images);
    expect(b.partVisage).toBe(0);
    expect(b.partHorsCadre).toBe(100);
    const c = constats(b);
    expect(c.map((x) => x.label)).toEqual(["Regard vers le jury", "Décrochages", "Hors cadre"]);
    expect(c.some((x) => x.label === "Tenue de tête")).toBe(false);
  });

  it("juge tout dès que le visage est vu la moitié du temps", () => {
    const images = Array.from({ length: 100 }, (_, i) => ({ tMs: i * 200, visage: i % 2 === 0, lacetDeg: 3, sourire: 0.5 }));
    const b = analyserImages(images);
    expect(b.partVisage).toBe(50);
    expect(constats(b).some((x) => x.label === "Tenue de tête")).toBe(true);
  });
});
