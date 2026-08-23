/**
 * L'appel avec le jury IA : un vrai entretien à la voix, en direct. Le jury
 * pose une question, écoute la réponse, rebondit dessus — il ne lit pas une
 * liste. Ici : les personas, le contexte envoyé au modèle, les prompts de
 * chaque tour et du débrief, et leurs parseurs. Pur et testé ; la voix et
 * le micro vivent côté navigateur, l'appel au modèle côté serveur.
 */

export type ModeAppel = "soutenance" | "entretien" | "pitch" | "concours";

export interface Persona {
  mode: ModeAppel;
  nom: string;
  role: string;
  /** Ce que ce jury cherche à vérifier, dans l'ordre où il l'aborde d'habitude. */
  axes: string[];
  /** Phrase d'ouverture prononcée avant la première question. */
  ouverture: string;
}

export const PERSONAS: Record<ModeAppel, Persona> = {
  soutenance: {
    mode: "soutenance",
    nom: "Jury de soutenance",
    role: "un membre de jury de soutenance universitaire (PFA, PFE, mémoire, thèse) : exigeant, bienveillant, précis",
    axes: ["la compréhension du problème et du contexte", "les choix techniques et leurs alternatives", "la méthode d'évaluation et les chiffres", "les limites et ce qui a été mal fait", "la contribution personnelle et le recul"],
    ouverture: "Bonjour, merci pour cette présentation. Nous allons passer aux questions.",
  },
  entretien: {
    mode: "entretien",
    nom: "Recruteur",
    role: "un recruteur (RH puis technique) pour un stage, une alternance ou un premier emploi : direct, curieux, attentif aux preuves concrètes",
    axes: ["le parcours et la motivation pour ce poste", "une expérience détaillée (situation, actions, résultat)", "les compétences clés de l'offre, avec des preuves", "la façon de travailler en équipe et de gérer un blocage", "les questions du candidat et la disponibilité"],
    ouverture: "Bonjour, merci d'être là. On va discuter une quinzaine de minutes de votre parcours et du poste.",
  },
  pitch: {
    mode: "pitch",
    nom: "Jury d'innovation",
    role: "un membre de jury de concours d'innovation ou de startup : pragmatique, sceptique sur les promesses, intéressé par les preuves et le marché",
    axes: ["le problème et pour qui", "la solution et ce qui existe déjà", "la preuve : utilisateurs, chiffres, tests", "le modèle économique et les prochaines étapes", "l'équipe et les risques"],
    ouverture: "Merci pour ce pitch. J'ai quelques questions.",
  },
  concours: {
    mode: "concours",
    nom: "Jury d'admission",
    role: "un membre de jury d'admission (école, master, bourse) : il évalue la personne, la cohérence du projet et la connaissance du programme",
    axes: ["la présentation et le parcours", "le projet professionnel et sa cohérence", "pourquoi ce programme précisément", "la culture du domaine et l'actualité", "les qualités, les faiblesses, la capacité à réagir"],
    ouverture: "Bonjour, installez-vous. Présentez-vous en quelques phrases, puis nous échangerons.",
  },
};

export const DUREES_APPEL = [5, 10, 15] as const;
export const LIMITES_APPEL = { contexteChars: 7000, repliqueChars: 500, reponseChars: 3000, toursMax: 30 } as const;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ContexteAppel {
  mode: ModeAppel;
  /** Texte de contexte (slides, mémoire, CV + offre, dossier), déjà tronqué. */
  contexte: string;
  langue: "fr" | "en";
  dureeMin: number;
}

/** Assemble le contexte à partir de ce qu'on a, sans dépasser la limite. */
export function assemblerContexte(parties: Array<{ titre: string; texte?: string | null }>, max: number = LIMITES_APPEL.contexteChars): string {
  const utiles = parties.filter((p) => p.texte && p.texte.trim().length > 20);
  if (utiles.length === 0) return "";
  const part = Math.floor(max / utiles.length);
  return utiles.map((p) => `## ${p.titre}\n${p.texte!.trim().slice(0, part)}`).join("\n\n");
}

/** Le prompt système d'un tour : qui est le jury, ce qu'il sait, comment il parle. */
export function construirePromptTour(c: ContexteAppel, ecouleS: number): string {
  const p = PERSONAS[c.mode];
  const totalS = c.dureeMin * 60;
  const resteS = Math.max(0, totalS - ecouleS);
  const phase = resteS <= 45 ? "conclusion" : ecouleS < 30 ? "ouverture" : "milieu";
  const langue = c.langue === "en" ? "Speak English only." : "Tu parles uniquement en français, naturel, à l'oral (pas de listes, pas de markdown).";
  return [
    `Tu es ${p.role}. Tu mènes un oral en direct, à la voix, avec un candidat. ${langue}`,
    `Axes à couvrir au fil de l'entretien (pas forcément dans l'ordre, pas tous si le temps manque) : ${p.axes.map((a, i) => `${i + 1}) ${a}`).join(" ; ")}.`,
    "Règles : une seule question à la fois, courte (une ou deux phrases). Réagis à ce que le candidat vient de dire : si c'est vague, demande un exemple ou un chiffre ; si c'est faux ou incohérent avec le dossier, fais-le remarquer calmement ; si c'est solide, dis-le en trois mots et passe à autre chose. Ne répète pas une question déjà posée. Ne donne pas la réponse. Ne commente jamais la forme (débit, hésitations).",
    c.contexte ? `Ce que tu sais du candidat et de son dossier (tu peux y faire référence précisément) :\n${c.contexte}` : "Tu n'as pas de dossier : pose des questions générales de ce type d'oral, puis creuse ce que le candidat raconte.",
    `Temps : ${Math.round(ecouleS / 60)} min écoulées sur ${c.dureeMin}. Phase : ${phase}.`,
    phase === "conclusion"
      ? "C'est la fin : remercie, conclus en une phrase, et mets \"fin\" à true."
      : phase === "ouverture"
        ? `Si l'historique est vide, commence par : « ${p.ouverture} » suivi de ta première question. Sinon, continue.`
        : "Continue l'entretien.",
    'Réponds en JSON strict : {"replique": "ce que tu dis, tel quel", "fin": false}',
  ].join("\n\n");
}

export interface Tour {
  replique: string;
  fin: boolean;
}

export function parseTour(brut: string): Tour | null {
  try {
    const nettoye = brut.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const j = JSON.parse(nettoye) as { replique?: unknown; fin?: unknown };
    if (typeof j.replique !== "string" || j.replique.trim() === "") return null;
    return { replique: j.replique.trim().slice(0, LIMITES_APPEL.repliqueChars), fin: j.fin === true };
  } catch {
    return null;
  }
}

/** Nettoie l'historique reçu du client : rôles connus, textes bornés, pas plus de N tours. */
export function validerHistorique(brut: unknown): Message[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((m): m is { role: string; content: string } => Boolean(m) && typeof m === "object" && typeof (m as { role?: unknown }).role === "string" && typeof (m as { content?: unknown }).content === "string")
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as Message["role"], content: m.content.trim().slice(0, m.role === "user" ? LIMITES_APPEL.reponseChars : LIMITES_APPEL.repliqueChars) }))
    .filter((m) => m.content !== "")
    .slice(-LIMITES_APPEL.toursMax * 2);
}

export interface Debrief {
  diagnostic: string;
  bienFait: { point: string; citation: string; pourquoi: string }[];
  momentsManques: { question: string; ceQueTuAsDit: string; mieux: string }[];
  planAction: string[];
  questionsPosees: string[];
}

/** Le débrief après l'appel : le même regard qu'un coach qui a assisté à l'oral. Aucune note. */
export function construirePromptDebrief(c: ContexteAppel, historique: Message[]): string {
  const p = PERSONAS[c.mode];
  const dialogue = historique.map((m) => `${m.role === "assistant" ? p.nom.toUpperCase() : "CANDIDAT"} : ${m.content}`).join("\n");
  const langue = c.langue === "en" ? "Write in English." : "Écris en français, tutoie le candidat, phrases courtes et concrètes.";
  return [
    `Tu es un coach d'oral. Tu viens d'assister à un ${p.nom.toLowerCase()} simulé de ${c.dureeMin} minutes. ${langue}`,
    "Ton débrief ne note pas et ne classe pas : il dit ce qui a marché (en citant les mots exacts du candidat), les moments manqués (la question, ce qu'il a dit, ce qu'une meilleure réponse aurait contenu), et un plan d'action en trois points pour la prochaine fois. Sois précis, jamais flatteur. Ne commente pas la forme orale (débit, hésitations) : elle est mesurée ailleurs. Les « citation » sont uniquement des mots prononcés par le CANDIDAT dans le dialogue — jamais une phrase du dossier. S'il n'a rien dit de bien, « bienFait » reste vide.",
    c.contexte ? `Dossier du candidat :\n${c.contexte.slice(0, 3000)}` : "",
    `Dialogue :\n${dialogue}`,
    'Réponds en JSON strict : {"diagnostic": "une phrase", "bienFait": [{"point": "", "citation": "mots exacts du candidat", "pourquoi": ""}], "momentsManques": [{"question": "", "ceQueTuAsDit": "", "mieux": ""}], "planAction": ["", "", ""], "questionsPosees": ["", ""]}',
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseDebrief(brut: string): Debrief | null {
  try {
    const nettoye = brut.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const j = JSON.parse(nettoye) as Partial<Debrief>;
    if (typeof j.diagnostic !== "string") return null;
    const liste = <T,>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] => (Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? f(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null) : []);
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return {
      diagnostic: j.diagnostic.trim(),
      bienFait: liste(j.bienFait, (x) => (s(x.point) ? { point: s(x.point), citation: s(x.citation), pourquoi: s(x.pourquoi) } : null)).slice(0, 5),
      momentsManques: liste(j.momentsManques, (x) => (s(x.question) ? { question: s(x.question), ceQueTuAsDit: s(x.ceQueTuAsDit), mieux: s(x.mieux) } : null)).slice(0, 5),
      planAction: Array.isArray(j.planAction) ? j.planAction.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()).slice(0, 5) : [],
      questionsPosees: Array.isArray(j.questionsPosees) ? j.questionsPosees.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()).slice(0, 20) : [],
    };
  } catch {
    return null;
  }
}

/** Ce que le candidat a dit, bout à bout : c'est ce qu'on mesure (débit, béquilles…). */
export function paroleCandidat(historique: Message[]): string {
  return historique
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
}
