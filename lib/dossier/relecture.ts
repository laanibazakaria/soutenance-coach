/**
 * La relecture du dossier : la seule opération de la plateforme qui regarde le
 * rapport ET la présentation ensemble.
 *
 * C'est ce que fait un rapporteur avant la séance — confronter ce que le
 * candidat montre à ce qu'il a écrit. Jusqu'ici chaque fonction ne voyait
 * qu'une moitié : les questions du jury partaient des diapositives seules, la
 * lecture du mémoire du rapport seul. Une contradiction entre les deux ne
 * pouvait donc être vue par personne — sauf par le jury, le jour J.
 *
 * Fonctions pures, testables sans navigateur ni réseau.
 */

import { memesNombres } from "./nombres";
import type { Deck } from "../slides/types";

/** Ce que le modèle a compris du travail — pour que le candidat vérifie. */
export interface Compris {
  sujet: string;
  problematique: string;
  methode: string;
  resultats: string;
}

/** Une contradiction entre la présentation et le rapport. */
export interface Incoherence {
  /** De quoi il s'agit, en quelques mots. */
  quoi: string;
  /** Ce que dit la présentation, cité. */
  presentation: string;
  /** Ce que dit le rapport, cité. */
  rapport: string;
  /** Une contradiction chiffrée se défend mal ; une nuance de formulation, si. */
  gravite: "haute" | "moyenne";
}

/** Une question que le jury posera, et à laquelle le dossier ne répond pas. */
export interface Manque {
  question: string;
  pourquoi: string;
}

export interface Relecture {
  compris: Compris;
  incoherences: Incoherence[];
  manques: Manque[];
}

export const LIMITES_RELECTURE = {
  /** Le rapport, pour la confrontation. Au-delà, on le dit au candidat. */
  rapportChars: 40_000,
  /** Les diapositives tiennent presque toujours ; on borne quand même. */
  slidesChars: 20_000,
  incoherencesMax: 8,
  manquesMax: 6,
  champChars: 400,
} as const;

/** Le texte des diapositives, numéroté — le numéro sert à citer sans inventer. */
export function formaterSlides(deck: Deck, max: number = LIMITES_RELECTURE.slidesChars): string {
  const tout = deck.slides.map((s) => `[Diapositive ${s.numero}] ${s.texte.trim()}`).join("\n\n");
  return tout.slice(0, max);
}

export interface DemandeRelecture {
  deck: Deck;
  rapport: string;
  /** Vrai si le rapport a été coupé : le prompt doit le savoir pour ne pas conclure. */
  rapportTronque?: boolean;
}

/**
 * Le prompt. Deux exigences le gouvernent, tirées d'un défaut observé en vrai :
 * un modèle sommé de citer cite, quitte à inventer un numéro de page. On ne lui
 * demande donc que ce qu'il a sous les yeux, et on lui interdit de conclure sur
 * ce qui manque.
 */
export function construirePromptRelecture(d: DemandeRelecture): string {
  const rapport = d.rapport.trim().slice(0, LIMITES_RELECTURE.rapportChars);
  return [
    "Tu es le rapporteur d'un jury de soutenance. Tu as sous les yeux DEUX documents du même candidat : sa présentation et son rapport. Ton travail, avant la séance : vérifier qu'ils disent la même chose.",
    `LA PRÉSENTATION (${d.deck.slides.length} diapositives) :\n${formaterSlides(d.deck)}`,
    d.rapportTronque
      ? `LE RAPPORT (début seulement — la suite ne t'a pas été donnée) :\n${rapport}`
      : `LE RAPPORT :\n${rapport}`,
    "TON TRAVAIL, en trois parties.",
    "1) CE QUE TU AS COMPRIS : le sujet, la problématique, la méthode, les résultats. Reformule-les avec tes mots, sans jargon recopié. Le candidat doit pouvoir vérifier d'un coup d'œil que tu n'as pas compris de travers.",
    `2) LES INCOHÉRENCES entre les deux documents (au plus ${LIMITES_RELECTURE.incoherencesMax}) : deux affirmations qui ne peuvent pas être vraies en même temps. Un chiffre qui diffère, une affirmation de la présentation que le rapport contredit, un plan annoncé puis pas suivi, une définition qui change de sens.\nN'EST PAS UNE INCOHÉRENCE — et ne doit jamais être signalé : la même valeur écrite autrement (« 45 » et « quarante-cinq », « 6 semaines » et « du 1er juillet au 7 août ») ; une date au même jour dans un autre format ; une numérotation de section qui diffère entre les deux documents, c'est normal et attendu ; un titre de diapositive plus court ou plus long que le titre de section correspondant ; une idée exprimée avec d'autres mots ; un détail présent d'un côté et simplement absent de l'autre, sans que rien ne le contredise. Avant de signaler un écart, demande-toi si les deux phrases peuvent être vraies ensemble : si oui, ce n'est pas un écart. Pour chacune, cite le passage de la présentation ET celui du rapport, mot pour mot. "gravite" vaut "haute" quand les deux affirmations se contredisent franchement — deux chiffres différents pour la même chose, deux faits incompatibles. "moyenne" quand la contradiction est réelle mais mineure. Dans le doute, ne signale rien : un écart inventé coûte plus cher au candidat que dix écarts manqués, parce qu'il le fera douter d'un document qui allait bien.`,
    `3) CE QUI MANQUE POUR LE JURY (au plus ${LIMITES_RELECTURE.manquesMax}) : les questions qu'un jury posera et auxquelles aucun des deux documents ne répond — un résultat sans protocole de mesure, un choix technique sans justification, une limite jamais nommée.`,
    "RÈGLES. Ne cite que ce qui figure ci-dessus, mot pour mot. N'invente jamais un numéro de page, de ligne ou de figure. Si tu ne trouves aucune incohérence, rends une liste vide — c'est un résultat, pas un échec, et mieux vaut cela qu'une contradiction fabriquée." +
      (d.rapportTronque
        ? " Le rapport t'a été donné tronqué : ne conclus jamais qu'une chose est « absente du rapport », dis au mieux qu'elle ne figure pas dans ce que tu as lu."
        : ""),
    'Réponds en JSON strict, sans texte autour : {"compris":{"sujet":"","problematique":"","methode":"","resultats":""},"incoherences":[{"quoi":"","presentation":"","rapport":"","gravite":"haute"}],"manques":[{"question":"","pourquoi":""}]}',
  ].join("\n\n");
}

const texte = (v: unknown): string =>
  typeof v === "string" ? v.trim().slice(0, LIMITES_RELECTURE.champChars) : "";

/**
 * Analyse la réponse du modèle. Tout ce qui est incomplet est écarté plutôt que
 * rempli : une incohérence sans ses deux citations ne prouve rien, et une
 * demi-incohérence affichée serait pire qu'aucune.
 */
export function parseRelecture(brut: string): Relecture | null {
  try {
    const nettoye = brut.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const j = JSON.parse(nettoye) as Record<string, unknown>;
    const c = (j.compris ?? {}) as Record<string, unknown>;
    const compris: Compris = {
      sujet: texte(c.sujet),
      problematique: texte(c.problematique),
      methode: texte(c.methode),
      resultats: texte(c.resultats),
    };
    if (!compris.sujet && !compris.problematique) return null;

    const brutInc = Array.isArray(j.incoherences) ? j.incoherences : [];
    const incoherences: Incoherence[] = brutInc
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return {
          quoi: texte(o.quoi),
          presentation: texte(o.presentation),
          rapport: texte(o.rapport),
          gravite: o.gravite === "haute" ? ("haute" as const) : ("moyenne" as const),
        };
      })
      // Sans les deux côtés, il n'y a pas de confrontation : on jette.
      .filter((i) => i.quoi && i.presentation && i.rapport)
      // Et si les deux citations portent exactement les mêmes nombres, la
      // « contradiction chiffrée » n'en est pas une : « quarante-cinq » et
      // « 45 » disent la même chose. Vérifié par du code plutôt que confié à
      // la bonne volonté du modèle.
      .filter((i) => !memesNombres(i.presentation, i.rapport))
      .slice(0, LIMITES_RELECTURE.incoherencesMax);

    const brutManques = Array.isArray(j.manques) ? j.manques : [];
    const manques: Manque[] = brutManques
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return { question: texte(o.question), pourquoi: texte(o.pourquoi) };
      })
      .filter((m) => m.question)
      .slice(0, LIMITES_RELECTURE.manquesMax);

    return { compris, incoherences, manques };
  } catch {
    return null;
  }
}

/** Les contradictions de fait d'abord : ce sont celles qui coûtent cher. */
export function trierIncoherences(l: readonly Incoherence[]): Incoherence[] {
  return [...l].sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === "haute" ? -1 : 1));
}

/** Une phrase honnête sur ce qui a été relu — le candidat doit savoir. */
export function resumerPortee(deck: Deck, rapportChars: number): string {
  const pages = Math.max(1, Math.round(rapportChars / 2000));
  const lu = Math.min(rapportChars, LIMITES_RELECTURE.rapportChars);
  const pagesLues = Math.max(1, Math.round(lu / 2000));
  const diapos = `${deck.slides.length} diapositive${deck.slides.length > 1 ? "s" : ""}`;
  if (rapportChars <= LIMITES_RELECTURE.rapportChars) {
    return `${diapos} et ${pages} page${pages > 1 ? "s" : ""} de rapport, confrontées.`;
  }
  return `${diapos} et les ${pagesLues} premières pages du rapport sur ${pages}, confrontées.`;
}
