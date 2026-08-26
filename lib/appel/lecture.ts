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
 * Le jury lit le dossier ENTIER, ligne à ligne. Un document ne tient pas
 * toujours en un seul appel : on le découpe en passes de 45 000 caractères
 * (une trentaine de pages), et le jury complète ses notes à chaque passe.
 * Douze passes couvrent une thèse de trois cents pages.
 */
export const LIMITES_LECTURE = { passeChars: 45_000, passesMax: 12, ligneChars: 240, listeMax: 6 } as const;

/** Tout ce qu'on peut lire en une lecture, toutes passes comprises. */
export const DOSSIER_MAX = LIMITES_LECTURE.passeChars * LIMITES_LECTURE.passesMax;

const PERSONNAGES: Record<ModeAppel, string> = {
  soutenance: "le rapporteur d'un jury de soutenance d'école d'ingénieurs",
  entretien: "un recruteur qui a lu le CV et l'offre",
};

/**
 * Découpe le dossier en passes, en coupant à une fin de ligne : on ne scinde
 * pas une phrase entre deux lectures.
 *
 * Cette fonction ne perd JAMAIS de texte — c'est tout l'enjeu : le jury doit
 * lire chaque ligne. Le nombre de passes n'est pas borné ici ; c'est à
 * l'appelant de décider combien il en lit, et de le dire honnêtement.
 */
export function decouperDossier(dossier: string, taille: number = LIMITES_LECTURE.passeChars): string[] {
  const t = dossier.trim();
  if (t.length === 0) return [];
  if (t.length <= taille) return [t];
  const passes: string[] = [];
  let reste = t;
  while (reste.length > taille) {
    const fenetre = reste.slice(0, taille);
    const coupure = Math.max(fenetre.lastIndexOf("\n"), fenetre.lastIndexOf(". "));
    const fin = coupure > taille * 0.5 ? coupure + 1 : taille;
    passes.push(reste.slice(0, fin).trim());
    reste = reste.slice(fin).trim();
  }
  if (reste.length > 0) passes.push(reste);
  return passes;
}

/**
 * Les passes réellement lues quand le document dépasse le budget. On garde
 * le début — c'est là qu'est le sujet — ET la fin, où vivent les limites et
 * la conclusion : sauter la fin reviendrait à manquer les vraies questions.
 */
export function passesARetenir(passes: string[], budget: number = LIMITES_LECTURE.passesMax): string[] {
  if (passes.length <= budget) return passes;
  return [...passes.slice(0, budget - 1), passes[passes.length - 1]!];
}

export function construirePromptLecture(mode: ModeAppel, dossier: string, passe?: { numero: number; total: number; dejaNote?: FicheLecture }): string {
  const suite = passe && passe.total > 1;
  const situation = suite
    ? `Tu lis un document long, en plusieurs fois. Voici la partie ${passe.numero} sur ${passe.total} — la suite exacte de ce que tu viens de lire.`
    : "Tu viens de lire le dossier ci-dessous, seul, avant la séance.";
  const notes = suite && passe.dejaNote ? `\nCE QUE TU AS DÉJÀ NOTÉ (ne le répète pas ; complète, corrige si cette partie te contredit)\n${resumerPourSuite(passe.dejaNote)}\n` : "";

  return `Tu es ${PERSONNAGES[mode]}. ${situation} Tu prends des notes pour toi — pas pour le candidat.

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
${notes}
LE DOSSIER${suite ? ` — PARTIE ${passe.numero}/${passe.total}` : ""}
${dossier.slice(0, LIMITES_LECTURE.passeChars)}

Réponds en JSON strict :
{"sujet":"une phrase","compris":["…"],"chiffres":["… : … "],"fragilites":["…"],"angles":["…"]}`;
}

/** Un résumé compact des notes déjà prises, pour la passe suivante. */
function resumerPourSuite(f: FicheLecture): string {
  const l = (titre: string, xs: string[]) => (xs.length > 0 ? `${titre} : ${xs.join(" | ")}` : "");
  return [f.sujet ? `Sujet : ${f.sujet}` : "", l("Acquis", f.compris), l("Chiffres", f.chiffres), l("Fragilités", f.fragilites)].filter(Boolean).join("\n");
}

/**
 * Réunit les notes de toutes les passes en une seule fiche. On garde l'ordre
 * de découverte et on écarte les redites : deux passes qui relèvent le même
 * chiffre ne doivent pas le lister deux fois.
 */
export function fusionnerFiches(fiches: FicheLecture[]): FicheLecture | null {
  const utiles = fiches.filter(Boolean);
  if (utiles.length === 0) return null;
  if (utiles.length === 1) return utiles[0]!;

  const cle = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .slice(0, 60);
  const reunir = (get: (f: FicheLecture) => string[], max: number) => {
    const vues = new Set<string>();
    const sortie: string[] = [];
    for (const f of utiles) {
      for (const x of get(f)) {
        const k = cle(x);
        if (k.length < 3 || vues.has(k)) continue;
        vues.add(k);
        sortie.push(x);
      }
    }
    return sortie.slice(0, max);
  };

  // Le sujet le plus complet l'emporte : la dernière passe a vu tout le document.
  const sujet = [...utiles].reverse().map((f) => f.sujet).find((s) => s.length > 0) ?? "";
  return {
    sujet,
    compris: reunir((f) => f.compris, LIMITES_LECTURE.listeMax + 2),
    chiffres: reunir((f) => f.chiffres, LIMITES_LECTURE.listeMax + 4),
    fragilites: reunir((f) => f.fragilites, LIMITES_LECTURE.listeMax + 2),
    angles: reunir((f) => f.angles, LIMITES_LECTURE.listeMax + 2),
  };
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
