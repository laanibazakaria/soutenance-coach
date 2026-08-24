/**
 * Ce que le jury a compris du dossier, avant de parler.
 *
 * Un vrai jury ne découvre pas le sujet en séance : il a lu le mémoire et les
 * diapositives, il est arrivé avec ses questions. Cette étape reproduit cela —
 * l'IA lit le dossier une fois, en tire une fiche de lecture, et cette fiche
 * sert de mémoire pendant tout l'appel. C'est aussi ce qui évite les questions
 * interchangeables : les angles viennent des faiblesses repérées dans CE
 * dossier, pas du sujet en général.
 *
 * Pur et testé : ni réseau, ni stockage.
 */

import type { ModeAppel } from "./index";

export interface FicheLecture {
  /** Le sujet en une phrase, tel que le jury l'a compris. */
  sujet: string;
  /** Ce que le candidat affirme — les points que le jury tient pour acquis. */
  compris: string[];
  /** Les chiffres relevés, avec ce qu'ils désignent. */
  chiffres: string[];
  /** Ce qui manque, ce qui est flou, ce qui n'est pas prouvé. */
  fragilites: string[];
  /** Les angles d'attaque retenus pour l'oral, du plus important au moins. */
  angles: string[];
}

/**
 * Le jury lit le dossier ENTIER, ou presque : 60 000 caractères, soit un
 * mémoire de cent pages. Avec 12 000, il ne voyait que la page de garde et
 * l'introduction — et posait donc toujours les mêmes questions de surface.
 */
export const LIMITES_LECTURE = { dossierChars: 60_000, ligneChars: 240, listeMax: 6 } as const;

const PERSONNAGES: Record<ModeAppel, string> = {
  soutenance: "le rapporteur d'un jury de soutenance d'école d'ingénieurs",
  entretien: "un recruteur qui a lu le CV et l'offre",
  pitch: "un jury de concours d'innovation qui a lu le dossier",
  concours: "un jury d'admission qui a lu le dossier de candidature",
};

export function construirePromptLecture(mode: ModeAppel, dossier: string): string {
  return `Tu es ${PERSONNAGES[mode]}. Tu viens de lire le dossier ci-dessous, seul, avant la séance. Tu prends des notes pour toi — pas pour le candidat.

CE QUE TU NOTES
- Le sujet, en une phrase, tel que TU l'as compris (si c'est confus, dis-le).
- Ce que le candidat affirme et que tu tiens pour acquis.
- Les chiffres que tu relèves, avec ce qu'ils mesurent.
- Les fragilités : ce qui manque, ce qui est affirmé sans preuve, ce qui se contredit, ce qui est trop beau.
- Les angles que tu comptes creuser en séance, du plus important au moins important.

RÈGLES
- Tu ne juges pas la personne, tu lis un document.
- Chaque fragilité doit pointer quelque chose de PRÉCIS dans le dossier, pas une généralité applicable à n'importe quel travail.
- Si le dossier est trop mince pour dire quoi que ce soit, écris-le dans "sujet" et laisse les listes courtes.
- En français, à la troisième personne, factuel.

LE DOSSIER
${dossier.slice(0, LIMITES_LECTURE.dossierChars)}

Réponds en JSON strict :
{"sujet":"une phrase","compris":["…"],"chiffres":["… : … "],"fragilites":["…"],"angles":["…"]}`;
}

function liste(v: unknown, max = LIMITES_LECTURE.listeMax): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, LIMITES_LECTURE.ligneChars))
    .filter((x) => x.length > 2)
    .slice(0, max);
}

export function parseLecture(brut: string): FicheLecture | null {
  const t = brut.trim();
  const debut = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(t.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const sujet = typeof j.sujet === "string" ? j.sujet.trim().slice(0, 400) : "";
  const fiche: FicheLecture = {
    sujet,
    compris: liste(j.compris),
    chiffres: liste(j.chiffres),
    fragilites: liste(j.fragilites),
    angles: liste(j.angles),
  };
  // Une fiche sans sujet ni contenu n'apporte rien : autant ne pas la garder.
  if (!fiche.sujet && fiche.compris.length === 0 && fiche.fragilites.length === 0) return null;
  return fiche;
}

/**
 * La fiche, remise au jury pendant l'appel. Les fragilités et les angles
 * passent en premier : c'est ce qui doit guider ses questions.
 */
export function contexteFiche(f: FicheLecture | null): string {
  if (!f) return "";
  const bloc = (titre: string, lignes: string[]) => (lignes.length > 0 ? `${titre} :\n${lignes.map((l) => `- ${l}`).join("\n")}` : "");
  return [
    "TES NOTES DE LECTURE (tu as lu le dossier avant la séance)",
    f.sujet ? `Sujet : ${f.sujet}` : "",
    bloc("Ce que tu comptes creuser, dans cet ordre", f.angles),
    bloc("Fragilités repérées — c'est là qu'il faut appuyer", f.fragilites),
    bloc("Chiffres relevés", f.chiffres),
    bloc("Acquis", f.compris),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Assez de matière pour que la lecture ait un sens ? */
export function dossierSuffisant(dossier: string): boolean {
  return dossier.trim().length >= 400;
}
