/**
 * Évaluation d'une réponse au jury.
 *
 * Deux couches, fidèles à la règle du projet :
 *
 * 1. **Le déterministe d'abord** (ce module, `analyserReponse`) : longueur,
 *    hésitations, présence d'exemples concrets, temps de réponse. Calculé,
 *    testé, gratuit, fonctionne hors ligne.
 * 2. **Le qualitatif ensuite** (le modèle) : ce que le jury attendait, ce qui
 *    manque dans le fond. Le modèle **ne produit aucune note chiffrée** — il
 *    formule à partir des faits déjà établis ici.
 */

import { countFillers, totalFillers } from "../scoring/fillers";
import type { JuryQuestion } from "../slides/types";
import { consigneLangue, type LangueCourte } from "../langue";

export const SEUILS_REPONSE = {
  /** En dessous, la réponse est trop courte pour être évaluée honnêtement. */
  motsMinimum: 12,
  /** Réponse idéale : assez développée sans noyer le jury. */
  motsIdeaux: { min: 40, max: 180 },
  /** Densité de béquilles au-delà de laquelle l'hésitation s'entend. */
  bequillesPour100: 6,
  /** Un blanc de plus de N secondes avant de répondre se remarque. */
  latenceMaxSecondes: 8,
} as const;

export interface ConstatReponse {
  id: "longueur" | "hesitation" | "concret" | "latence";
  niveau: "bon" | "attention" | "alerte" | "absent";
  message: string;
}

export interface AnalyseReponse {
  motsCount: number;
  constats: ConstatReponse[];
}

/** Marqueurs d'un propos concret : exemples, chiffres, cas précis. */
const MARQUEURS_CONCRETS =
  /\b(par exemple|notamment|concr[èe]tement|c'est-[àa]-dire|en pratique|\d+\s*(%|pour cent|fois|jours?|mois|secondes?|minutes?|utilisateurs?|tests?))/iu;

/**
 * Analyse déterministe d'une réponse orale. Ne lève jamais d'exception.
 * `latenceMs` = temps écoulé entre l'affichage de la question et le début de
 * la réponse ; optionnel.
 */
export function analyserReponse(transcript: string, latenceMs?: number): AnalyseReponse {
  const mots = transcript.trim() === "" ? [] : transcript.trim().split(/\s+/);
  const motsCount = mots.length;
  const constats: ConstatReponse[] = [];

  // 1. Longueur
  if (motsCount < SEUILS_REPONSE.motsMinimum) {
    constats.push({
      id: "longueur",
      niveau: "alerte",
      message:
        motsCount === 0
          ? "Aucune réponse captée. Reprends la question et parle plus près du micro."
          : "Réponse très courte : le jury attend que tu développes, sinon il enchaîne avec une question plus difficile.",
    });
  } else {
    const { min, max } = SEUILS_REPONSE.motsIdeaux;
    constats.push({
      id: "longueur",
      niveau: motsCount >= min && motsCount <= max ? "bon" : "attention",
      message:
        motsCount < min
          ? `${motsCount} mots : un peu court. Une bonne réponse tient en 30 à 60 secondes, avec un exemple.`
          : motsCount > max
            ? `${motsCount} mots : tu t'étales. Le jury a d'autres questions — réponds, puis arrête-toi.`
            : `${motsCount} mots : une réponse de bonne longueur.`,
    });
  }

  // 2. Hésitation — seulement si la réponse est assez longue pour être significative.
  if (motsCount >= SEUILS_REPONSE.motsMinimum) {
    const bequilles = totalFillers(countFillers(transcript));
    const densite = Math.round((bequilles / motsCount) * 100 * 10) / 10;
    constats.push({
      id: "hesitation",
      niveau: densite <= SEUILS_REPONSE.bequillesPour100 ? "bon" : "attention",
      message:
        bequilles === 0
          ? "Aucune hésitation audible : tu maîtrises ta réponse."
          : `${bequilles} hésitation${bequilles > 1 ? "s" : ""} (${densite} pour 100 mots)${
              densite <= SEUILS_REPONSE.bequillesPour100
                ? " : c'est normal à l'oral."
                : " : ça s'entend. Prends une seconde de silence plutôt qu'un « euh »."
            }`,
    });
  } else {
    constats.push({
      id: "hesitation",
      niveau: "absent",
      message: "Réponse trop courte pour juger l'hésitation.",
    });
  }

  // 3. Concret
  if (motsCount >= SEUILS_REPONSE.motsMinimum) {
    const concret = MARQUEURS_CONCRETS.test(transcript);
    constats.push({
      id: "concret",
      niveau: concret ? "bon" : "attention",
      message: concret
        ? "Ta réponse s'appuie sur du concret (exemple ou chiffre) — c'est ce qui convainc un jury."
        : "Aucun exemple ni chiffre repéré. Une réponse générale se retient mal : ancre-la sur un cas précis de ton projet.",
    });
  } else {
    constats.push({
      id: "concret",
      niveau: "absent",
      message: "Réponse trop courte pour juger le niveau de détail.",
    });
  }

  // 4. Latence
  if (latenceMs === undefined) {
    constats.push({
      id: "latence",
      niveau: "absent",
      message: "Temps de réaction non mesuré.",
    });
  } else {
    const secondes = Math.round(latenceMs / 1000);
    constats.push({
      id: "latence",
      niveau: secondes <= SEUILS_REPONSE.latenceMaxSecondes ? "bon" : "attention",
      message:
        secondes <= SEUILS_REPONSE.latenceMaxSecondes
          ? `Tu as démarré en ${secondes} s : le jury n'a pas senti de flottement.`
          : `${secondes} s avant de commencer : le silence se remarque. Gagne du temps en reformulant la question à voix haute.`,
    });
  }

  return { motsCount, constats };
}

/* ── Contrat avec le modèle ──────────────────────────────────────────────── */

export interface DemandeEvaluation {
  question: JuryQuestion;
  reponse: string;
  /** Contexte du support, pour que l'avis colle au projet réel. */
  contexteSlides?: string;
  langue?: LangueCourte;
}

export interface AvisModele {
  /** Ce qui fonctionne dans la réponse. */
  points_forts: string[];
  /** Ce qu'un jury relèverait. */
  points_faibles: string[];
  /** Ce que le jury attendait précisément sur cette question. */
  attendu: string;
  /** Une relance probable si la réponse reste en surface. */
  relance: string;
}

/**
 * Construit la consigne envoyée au modèle. Isolée et testée : c'est ici que
 * se joue le garde-fou — on interdit explicitement toute note chiffrée.
 */
export function construirePrompt(demande: DemandeEvaluation, analyse: AnalyseReponse): string {
  const faits = analyse.constats
    .filter((c) => c.niveau !== "absent")
    .map((c) => `- ${c.message}`)
    .join("\n");

  return `Tu es un membre de jury de soutenance académique (école d'ingénieurs, Maroc/France). Un étudiant vient de répondre oralement à une question. Sa réponse a été transcrite automatiquement : ignore les fautes de transcription, juge le fond.

QUESTION POSÉE :
${demande.question.question}

POURQUOI CETTE QUESTION EST POSÉE :
${demande.question.pourquoi}
${demande.contexteSlides ? `\nCONTEXTE DU PROJET (extrait des diapositives) :\n${demande.contexteSlides.slice(0, 1500)}` : ""}

RÉPONSE DE L'ÉTUDIANT (transcription) :
${demande.reponse}

MESURES DÉJÀ CALCULÉES (ne les recalcule pas, ne les contredis pas) :
${faits || "- aucune"}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown, de la forme :
{
  "points_forts": ["..."],
  "points_faibles": ["..."],
  "attendu": "...",
  "relance": "..."
}

Règles impératives :
- N'attribue AUCUNE note, AUCUN score, AUCUN pourcentage. Tu juges le fond, pas en chiffres.
- 1 à 3 éléments par liste, une phrase chacun, en français, en tutoyant l'étudiant.
- "attendu" : ce qu'un jury espérait entendre sur cette question précise.
- "relance" : la question de relance qu'un jury poserait après cette réponse.
- Sois exigeant mais bienveillant : l'objectif est de progresser avant la vraie soutenance.${consigneLangue(demande.langue)}`;
}

/**
 * Valide la réponse du modèle. Le JSON peut arriver entouré de texte ou de
 * balises : on extrait, on vérifie la forme, et on refuse plutôt que de
 * deviner — un avis mal formé ne vaut pas mieux que pas d'avis.
 */
export function parseAvis(brut: string): AvisModele | null {
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const listeDeTextes = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null;
    const items = v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
    return items.length > 0 ? items.slice(0, 3) : null;
  };
  const forts = listeDeTextes(o.points_forts);
  const faibles = listeDeTextes(o.points_faibles);
  if (!forts || !faibles) return null;
  if (typeof o.attendu !== "string" || typeof o.relance !== "string") return null;
  return {
    points_forts: forts,
    points_faibles: faibles,
    attendu: o.attendu,
    relance: o.relance,
  };
}
