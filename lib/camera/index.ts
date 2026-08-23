/**
 * Ce que la caméra observe pendant un oral : regard vers le jury, tenue de
 * tête, sourire. Tout est calculé sur l'appareil à partir des points du
 * visage (MediaPipe) — l'image ne quitte jamais le navigateur, rien n'est
 * enregistré. Ce fichier est pur et testé : il ne connaît ni la caméra ni
 * MediaPipe, seulement des nombres.
 *
 * Règle du projet : on décrit, on ne note pas. « 62 % du temps vers le jury »
 * est un constat ; « 6/10 de contact visuel » serait une note inventée.
 */

/** Les signaux bruts d'une image, tels qu'on les tire des repères du visage. */
export interface ImageVisage {
  /** Horodatage en millisecondes depuis le début de l'oral. */
  tMs: number;
  /** Visage détecté sur cette image. */
  visage: boolean;
  /** Rotation de la tête en degrés : lacet (gauche/droite), tangage (haut/bas). */
  lacetDeg?: number;
  tangageDeg?: number;
  /** Regard dévié par rapport à l'axe de la tête, en unités MediaPipe (0 à 1). */
  regardHorizontal?: number;
  regardVertical?: number;
  /** Sourire, 0 à 1. */
  sourire?: number;
  /** Yeux fermés (clignement), 0 à 1. */
  yeuxFermes?: number;
}

export const SEUILS_CAMERA = {
  /** Au-delà, on considère que la personne ne regarde plus le jury. */
  lacetDeg: 22,
  tangageDeg: 18,
  regard: 0.42,
  /** À partir d'où un sourire compte. */
  sourire: 0.28,
  /** Une absence de plus de 2,5 s compte comme un décrochage. */
  decrochageMs: 2500,
  /** En dessous, on ne dit rien : trop peu d'images pour conclure. */
  imagesMin: 60,
} as const;

export interface EtatImage extends ImageVisage {
  /** Vrai si, sur cette image, la personne regarde vers le jury. */
  versJury: boolean;
}

/** Une image observée devient un état : regarde le jury, ou non. */
export function interpreter(img: ImageVisage): EtatImage {
  if (!img.visage) return { ...img, versJury: false };
  const lacet = Math.abs(img.lacetDeg ?? 0);
  const tangage = Math.abs(img.tangageDeg ?? 0);
  const rh = Math.abs(img.regardHorizontal ?? 0);
  const rv = Math.abs(img.regardVertical ?? 0);
  const versJury = lacet <= SEUILS_CAMERA.lacetDeg && tangage <= SEUILS_CAMERA.tangageDeg && rh <= SEUILS_CAMERA.regard && rv <= SEUILS_CAMERA.regard;
  return { ...img, versJury };
}

export interface Decrochage {
  debutMs: number;
  dureeMs: number;
}

export interface BilanCamera {
  /** Nombre d'images analysées (visage détecté ou non). */
  images: number;
  /** Durée observée, en millisecondes. */
  dureeMs: number;
  /** Part du temps passée à regarder vers le jury, 0 à 100. */
  partVersJury: number;
  /** Part du temps où aucun visage n'est vu (parti du cadre). */
  partHorsCadre: number;
  /** Les moments où le regard a quitté le jury plus de 2,5 s. */
  decrochages: Decrochage[];
  /** Part du temps avec un sourire visible. */
  partSourire: number;
  /** Stabilité de la tête : écart-type du lacet en degrés (plus c'est bas, plus c'est posé). */
  stabiliteDeg: number;
  /** Assez d'images pour dire quelque chose ? */
  exploitable: boolean;
  /** Part des images où un visage est vu — en dessous de 30 %, on ne juge ni sourire ni tenue. */
  partVisage: number;
}

export function analyserImages(images: ImageVisage[]): BilanCamera {
  const etats = images.map(interpreter);
  const n = etats.length;
  const vide: BilanCamera = { images: n, dureeMs: 0, partVersJury: 0, partHorsCadre: 0, decrochages: [], partSourire: 0, stabiliteDeg: 0, exploitable: false, partVisage: 0 };
  if (n === 0) return vide;

  const dureeMs = Math.max(0, (etats[n - 1]!.tMs ?? 0) - (etats[0]!.tMs ?? 0));
  const pourcent = (compte: number) => Math.round((compte / n) * 1000) / 10;
  const versJury = etats.filter((e) => e.versJury).length;
  const horsCadre = etats.filter((e) => !e.visage).length;
  const sourires = etats.filter((e) => (e.sourire ?? 0) >= SEUILS_CAMERA.sourire).length;

  const lacets = etats.filter((e) => e.visage && e.lacetDeg !== undefined).map((e) => e.lacetDeg!);
  const moyenne = lacets.length ? lacets.reduce((a, b) => a + b, 0) / lacets.length : 0;
  const variance = lacets.length ? lacets.reduce((a, b) => a + (b - moyenne) ** 2, 0) / lacets.length : 0;

  // Un décrochage : une suite d'images sans regard vers le jury, assez longue.
  const decrochages: Decrochage[] = [];
  let debut: number | null = null;
  for (const e of etats) {
    if (!e.versJury) {
      debut ??= e.tMs;
      continue;
    }
    if (debut !== null) {
      const duree = e.tMs - debut;
      if (duree >= SEUILS_CAMERA.decrochageMs) decrochages.push({ debutMs: debut, dureeMs: duree });
      debut = null;
    }
  }
  if (debut !== null) {
    const duree = (etats[n - 1]!.tMs ?? debut) - debut;
    if (duree >= SEUILS_CAMERA.decrochageMs) decrochages.push({ debutMs: debut, dureeMs: duree });
  }

  return {
    images: n,
    dureeMs,
    partVersJury: pourcent(versJury),
    partHorsCadre: pourcent(horsCadre),
    decrochages,
    partSourire: pourcent(sourires),
    stabiliteDeg: Math.round(Math.sqrt(variance) * 10) / 10,
    exploitable: n >= SEUILS_CAMERA.imagesMin,
    partVisage: pourcent(n - horsCadre),
  };
}

export type NiveauCamera = "bon" | "attention" | "alerte" | "absent";

export interface ConstatCamera {
  id: "regard" | "cadre" | "sourire" | "stabilite";
  label: string;
  valeur: string;
  niveau: NiveauCamera;
  phrase: string;
}

function mm(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}` : `${s} s`;
}

/** Les constats à afficher : des chiffres, une phrase, aucun jugement global. */
export function constats(b: BilanCamera): ConstatCamera[] {
  if (!b.exploitable) {
    return [{ id: "regard", label: "Caméra", valeur: "—", niveau: "absent", phrase: "Trop peu d'images pour conclure : garde la caméra allumée pendant l'oral." }];
  }
  const liste: ConstatCamera[] = [];

  liste.push({
    id: "regard",
    label: "Regard vers le jury",
    valeur: `${b.partVersJury} %`,
    niveau: b.partVersJury >= 70 ? "bon" : b.partVersJury >= 45 ? "attention" : "alerte",
    phrase:
      b.partVersJury >= 70
        ? `Tu regardes le jury ${b.partVersJury} % du temps : c'est ce qu'on attend d'un oral.`
        : b.partVersJury >= 45
          ? `${b.partVersJury} % du temps vers le jury. Le reste va sur tes notes ou ton écran — vise 70 %.`
          : `${b.partVersJury} % du temps seulement vers le jury : tu lis. Mémorise tes transitions, elles sont ce qui te fait décrocher.`,
  });

  if (b.decrochages.length > 0) {
    const plusLong = b.decrochages.reduce((a, d) => (d.dureeMs > a.dureeMs ? d : a));
    liste.push({
      id: "cadre",
      label: "Décrochages",
      valeur: String(b.decrochages.length),
      niveau: b.decrochages.length <= 2 ? "attention" : "alerte",
      phrase: `${b.decrochages.length} passage${b.decrochages.length > 1 ? "s" : ""} de plus de 2,5 s sans regarder le jury. Le plus long : ${mm(plusLong.dureeMs)} à ${mm(plusLong.debutMs)}.`,
    });
  }

  if (b.partHorsCadre >= 8) {
    liste.push({
      id: "cadre",
      label: "Hors cadre",
      valeur: `${b.partHorsCadre} %`,
      niveau: b.partHorsCadre >= 20 ? "alerte" : "attention",
      phrase: `Ton visage sort du cadre ${b.partHorsCadre} % du temps. Recule un peu et cale ton portable : le jury doit te voir.`,
    });
  }

  // Sans visage à l'image, on ne peut rien dire du sourire ni de la tenue de tête.
  if (b.partVisage < 30) return liste;

  liste.push({
    id: "sourire",
    label: "Visage ouvert",
    valeur: `${b.partSourire} %`,
    niveau: b.partSourire >= 10 ? "bon" : "attention",
    phrase: b.partSourire >= 10 ? `Tu souris ${b.partSourire} % du temps : ça se voit, et ça détend le jury.` : "Visage fermé du début à la fin. Un sourire à l'accroche et à la conclusion suffit à changer l'impression.",
  });

  liste.push({
    id: "stabilite",
    label: "Tenue de tête",
    valeur: `${b.stabiliteDeg}°`,
    niveau: b.stabiliteDeg <= 12 ? "bon" : b.stabiliteDeg <= 20 ? "attention" : "alerte",
    phrase:
      b.stabiliteDeg <= 12
        ? "Tête posée, mouvements calmes."
        : b.stabiliteDeg <= 20
          ? "Tu bouges pas mal la tête : balayer le jury est bien, se balancer non."
          : "Beaucoup de mouvement de tête : pose tes pieds, respire, et ne bouge que pour regarder quelqu'un.",
  });

  return liste;
}

/** Une ligne pour le débrief du coach, ou null si rien d'exploitable. */
export function ligneContexteCamera(b: BilanCamera | null): string | null {
  if (!b?.exploitable) return null;
  const morceaux = [`regard vers le jury ${b.partVersJury} % du temps`, b.decrochages.length ? `${b.decrochages.length} décrochage(s) de plus de 2,5 s` : null, b.partHorsCadre >= 8 ? `hors cadre ${b.partHorsCadre} %` : null].filter(Boolean);
  return `Observation caméra (mesurée sur l'appareil) : ${morceaux.join(", ")}.`;
}
