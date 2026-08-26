/**
 * La grille d'évaluation : douze critères pondérés par type d'oral. Le modèle
 * juge chaque critère et cite ce que le candidat a dit ; c'est le CODE qui
 * calcule la note pondérée.
 *
 * Le principe vient de Propulsez Coach IA (avec leur accord) et il est solide :
 * l'arithmétique est le point faible des modèles de langage. Une analyse
 * qualitative brillante peut s'accompagner d'une moyenne fausse que personne
 * ne vérifie — ni l'étudiant qui croit la jauge, ni nous. Donc : le modèle ne
 * fournit jamais le verdict chiffré final.
 *
 * Ce fichier est pur et testé : il ne connaît ni le réseau, ni le stockage.
 */

export type IdOral = "soutenance" | "entretien";

/**
 * À quel moment de l'oral un critère peut être observé.
 *
 * L'appel avec le jury ne fait que des questions : l'exposé n'a pas lieu. Noter
 * l'accroche, le plan ou la tenue du temps à partir d'un dialogue revient à
 * juger ce qui ne s'est pas produit — le modèle, sommé de remplir douze lignes,
 * en remplit douze. On ne lui soumet donc que les critères observables.
 */
export type Volet = "expose" | "questions";

export interface Critere {
  /** Où il s'observe. Par défaut « questions ». */
  volet?: Volet;
  id: number;
  titre: string;
  /** Poids dans la moyenne : ce qui compte double compte double. */
  poids: number;
  /** Ce qu'on regarde — repris tel quel dans la consigne donnée au modèle. */
  regarde: string;
}

export interface Grille {
  id: IdOral;
  nom: string;
  /** Qui évalue, dans la tête du modèle. */
  evaluateur: string;
  criteres: Critere[];
}

const SOUTENANCE: Critere[] = [
  { id: 1, titre: "Accroche et cadrage", poids: 1.5, volet: "expose", regarde: "Dès les premières phrases, on comprend le sujet, pour qui c'est un problème, et pourquoi ça mérite un travail." },
  { id: 2, titre: "Problématique explicite", poids: 2, regarde: "Une question de recherche formulée clairement, pas un thème vague." },
  { id: 3, titre: "Plan annoncé et tenu", poids: 1.5, volet: "expose", regarde: "Le plan est annoncé, les transitions sont marquées, et l'exposé suit ce qui a été annoncé." },
  { id: 4, titre: "Méthode justifiée", poids: 2, regarde: "Les choix techniques sont expliqués ET justifiés face aux alternatives écartées." },
  { id: 5, titre: "Résultats chiffrés", poids: 2, regarde: "Des chiffres précis, avec leur unité, leur protocole de mesure et leur point de comparaison." },
  { id: 6, titre: "Limites assumées", poids: 1.5, regarde: "Le candidat nomme lui-même ce que son travail ne prouve pas, avant qu'on le lui demande." },
  { id: 7, titre: "Réponses aux questions", poids: 2, regarde: "Il répond à la question posée, pas à celle qu'il aurait aimé qu'on lui pose ; il assume quand il ne sait pas." },
  { id: 8, titre: "Maîtrise de ses chiffres", poids: 1.5, regarde: "Il connaît ses propres chiffres sans hésiter, et ne se contredit pas d'une réponse à l'autre." },
  { id: 9, titre: "Gestion du temps", poids: 1, volet: "expose", regarde: "L'exposé tient dans le temps imparti, sans expédier la fin ni traîner sur le contexte." },
  { id: 10, titre: "Clarté de l'expression", poids: 1.5, regarde: "Phrases courtes, une idée à la fois, jargon expliqué, peu de mots béquilles." },
  { id: 11, titre: "Posture et regard", poids: 1, volet: "expose", regarde: "Il s'adresse au jury plutôt qu'à ses notes ou à ses diapositives." },
  { id: 12, titre: "Conclusion et ouverture", poids: 1, volet: "expose", regarde: "Une conclusion qui rappelle le résultat principal et ouvre sur une suite crédible." },
  { id: 13, titre: "Part personnelle", poids: 2, regarde: "Il dit ce qu'il a fait lui-même et le distingue de ce qu'ont fait son équipe, son encadrant ou des outils existants." },
];

const ENTRETIEN: Critere[] = [
  { id: 1, titre: "« Présentez-vous »", poids: 2, regarde: "Deux minutes structurées présent-passé-futur, orientées vers le poste visé." },
  { id: 2, titre: "Adéquation au poste", poids: 2, regarde: "Il relie explicitement son parcours aux exigences de l'offre." },
  { id: 3, titre: "Preuves concrètes", poids: 2, regarde: "Des exemples situés : situation, ce qu'il a fait lui, résultat obtenu." },
  { id: 4, titre: "Chiffres et résultats", poids: 1.5, regarde: "Ses réalisations sont quantifiées, pas seulement décrites." },
  { id: 5, titre: "Connaissance de l'entreprise", poids: 1.5, regarde: "Il sait ce que fait l'entreprise, son marché, et cite quelque chose de récent." },
  { id: 6, titre: "Motivation crédible", poids: 1.5, regarde: "Sa raison de vouloir CE poste est spécifique, pas interchangeable." },
  { id: 7, titre: "Écoute et réponses ciblées", poids: 2, regarde: "Il répond à ce qui est demandé, sans monologue ni hors-sujet." },
  { id: 8, titre: "Questions pièges", poids: 1.5, regarde: "Défauts, échecs, trous dans le CV : il assume sans se saborder ni mentir." },
  { id: 9, titre: "Ses questions au recruteur", poids: 1, regarde: "Il pose des questions qui montrent qu'il a réfléchi au poste et à l'équipe." },
  { id: 10, titre: "Attitude et énergie", poids: 1, regarde: "Ton engagé, ni éteint ni survendu." },
  { id: 11, titre: "Projection", poids: 1, regarde: "Il se projette concrètement dans les premiers mois du poste." },
  { id: 12, titre: "Clarté de l'expression", poids: 1, regarde: "Phrases courtes, vocabulaire précis, peu de mots béquilles." },
];



export const GRILLES: Record<IdOral, Grille> = {
  soutenance: { id: "soutenance", nom: "Soutenance", evaluateur: "un jury de soutenance d'école d'ingénieurs", criteres: SOUTENANCE },
  entretien: { id: "entretien", nom: "Entretien d'embauche", evaluateur: "un recruteur expérimenté", criteres: ENTRETIEN },
};

export const NOTE_MAX = 10;

export interface CritereEvalue {
  id: number;
  titre: string;
  poids: number;
  /** 0 à 10, ou null quand l'échange ne permet pas de juger. */
  note: number | null;
  /** Pourquoi cette note — une phrase, factuelle. */
  constat: string;
  /** Ce que le candidat a dit, mot pour mot. Vide si rien à citer. */
  citation: string;
  /** Une action concrète pour la prochaine fois. */
  conseil: string;
}

export interface Evaluation {
  oral: IdOral;
  /** Moyenne pondérée des critères évaluables — calculée ici, jamais par le modèle. */
  note: number | null;
  /** Somme des poids réellement pris en compte. */
  poidsRetenu: number;
  criteres: CritereEvalue[];
  /** Les trois critères qui coûtent le plus de points, du pire au moins pire. */
  prioritaires: CritereEvalue[];
  /** Ce qui est déjà solide (note ≥ 8). */
  acquis: CritereEvalue[];
  /** Vrai si trop peu de critères sont évaluables pour afficher une note. */
  insuffisant: boolean;
  /** Les volets réellement couverts : une note d'appel ne juge pas l'exposé. */
  volets: Volet[];
}

/**
 * Fraction du volet évalué en dessous de laquelle on n'affiche pas de note.
 *
 * C'était un seuil absolu de 6 sur des poids sommés à 18,5 : l'abstention ne
 * jouait donc qu'en dessous de 32 % de la grille, et un candidat pouvait lire
 * « Prêt » sur trois critères jugés sur douze. Un ratio suit la grille quand
 * elle change, et suit le volet quand l'oral n'en couvre qu'un.
 */
export const RATIO_MIN = 0.6;

function borner(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(NOTE_MAX, Math.max(0, Math.round(n * 10) / 10));
}

function texte(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Prend ce que le modèle a renvoyé et en fait une évaluation sûre : les notes
 * sont bornées, les critères manquants sont marqués non évaluables plutôt que
 * supprimés, et la moyenne pondérée est RECALCULÉE ici. Ce que le modèle a pu
 * écrire comme note globale est ignoré.
 */
export function criteresDuVolet(grille: Grille, volets: readonly Volet[]): Critere[] {
  return grille.criteres.filter((c) => volets.includes(c.volet ?? "questions"));
}

export function normaliser(brut: unknown, grille: Grille, volets: readonly Volet[] = ["expose", "questions"]): Evaluation {
  const source = (brut && typeof brut === "object" ? (brut as Record<string, unknown>) : {}) as { criteres?: unknown };
  const liste = Array.isArray(source.criteres) ? (source.criteres as Record<string, unknown>[]) : [];
  const parId = new Map<number, Record<string, unknown>>();
  for (const c of liste) {
    const id = typeof c?.id === "number" ? c.id : Number(c?.id);
    if (Number.isInteger(id)) parId.set(id, c);
  }

  // On ne retient que les critères observables dans ce qui s'est passé : après
  // un appel, l'exposé n'a pas eu lieu et rien ne permet de le noter.
  const retenus = criteresDuVolet(grille, volets);
  const criteres: CritereEvalue[] = retenus.map((def) => {
    const c = parId.get(def.id);
    return {
      id: def.id,
      titre: def.titre,
      poids: def.poids,
      note: c ? borner(c.note) : null,
      constat: c ? texte(c.constat, 400) : "",
      citation: c ? texte(c.citation, 300) : "",
      conseil: c ? texte(c.conseil, 300) : "",
    };
  });

  const evaluables = criteres.filter((c) => c.note !== null);
  const poidsRetenu = evaluables.reduce((s, c) => s + c.poids, 0);
  // Le seuil suit le volet : soixante pour cent de ce qui était observable,
  // pas une valeur absolue qui laissait passer un tiers de grille.
  const poidsPossible = retenus.reduce((t, c) => t + c.poids, 0);
  const insuffisant = poidsPossible === 0 || poidsRetenu < RATIO_MIN * poidsPossible;
  const somme = evaluables.reduce((s, c) => s + c.note! * c.poids, 0);
  const note = poidsRetenu > 0 && !insuffisant ? Math.round((somme / poidsRetenu) * 10) / 10 : null;

  // Ce qui coûte le plus : l'écart à 10, pondéré. Un critère lourd raté pèse
  // plus qu'un critère léger raté, même à note égale.
  const prioritaires = [...evaluables]
    .filter((c) => c.note! < 8)
    .sort((a, b) => (NOTE_MAX - b.note!) * b.poids - (NOTE_MAX - a.note!) * a.poids)
    .slice(0, 3);
  const acquis = evaluables.filter((c) => c.note! >= 8).sort((a, b) => b.note! - a.note!);

  return { oral: grille.id, note, poidsRetenu: Math.round(poidsRetenu * 10) / 10, volets: [...volets], criteres, prioritaires, acquis, insuffisant };
}

/**
 * Le mot qui va avec la note — jamais un jugement sur la personne.
 *
 * « Prêt » est réservé aux évaluations qui ont vu l'oral entier. Après un appel,
 * l'exposé n'a pas eu lieu : dire à un candidat qu'il est prêt sur ses seules
 * réponses le ferait cesser de préparer la moitié qui lui reste.
 */
export function mention(note: number | null, volets: readonly Volet[] = ["expose", "questions"]): string {
  if (note === null) return "Pas encore mesurable";
  const oralEntier = volets.includes("expose");
  if (note >= 8.5) return oralEntier ? "Prêt" : "Solide sur les questions";
  if (note >= 7) return "Presque prêt";
  if (note >= 5.5) return "En chemin";
  if (note >= 4) return "Des bases, du travail";
  return "À reprendre";
}

export function niveauCritere(note: number | null): "bon" | "attention" | "alerte" | "absent" {
  if (note === null) return "absent";
  if (note >= 8) return "bon";
  if (note >= 5.5) return "attention";
  return "alerte";
}

export interface DemandeGrille {
  oral: IdOral;
  /** L'échange : questions du jury et réponses du candidat. */
  echange: string;
  /** Ce qu'on sait du dossier (slides, mémoire, CV…). */
  contexte?: string;
  /** Les mesures déjà calculées par le code — le modèle ne les recalcule pas. */
  mesures?: string;
  dureeMin?: number;
  /** Ce que l'oral a réellement couvert. Un appel ne contient pas d'exposé. */
  volets?: readonly Volet[];
  /** La langue de l'oral : les constats et conseils suivent celle de l'appel. */
  langue?: "fr" | "en";
}

export function construirePrompt(d: DemandeGrille): string {
  const g = GRILLES[d.oral];
  const volets = d.volets ?? (["expose", "questions"] as const);
  const retenus = criteresDuVolet(g, volets);
  const criteres = retenus.map((c) => `${c.id}. ${c.titre} — ${c.regarde}`).join("\n");
  return `Tu es ${g.evaluateur}. Tu viens d'assister à un oral et tu remplis la grille d'évaluation officielle, critère par critère.

RÈGLES ABSOLUES
- Tu juges UNIQUEMENT ce qui est dans l'échange ci-dessous. Si un critère n'a pas pu être observé, mets "note": null — ne devine pas, ne sois pas généreux par défaut.
- Chaque note doit pouvoir être défendue devant le candidat : cite ses mots.
- Ne calcule AUCUNE moyenne, AUCUN total. On s'en occupe.
- Reste factuel et utile. Pas de compliment creux, pas de sévérité gratuite.
${d.langue === "en" ? '- Write in English, addressing the candidate directly in the advice ("start with…"). The criteria titles stay in French — quote them as they are.' : '- Écris en français, à la deuxième personne du singulier dans les conseils (« commence par… »).'}

LA GRILLE (${retenus.length} critères)${volets.includes("expose") ? "" : " — cet oral n'a comporté que des questions, les critères qui portent sur l'exposé ne te sont pas soumis ; ne les invente pas."}
${criteres}

${d.contexte ? `LE DOSSIER DU CANDIDAT\n${d.contexte}\n\n` : ""}${d.mesures ? `MESURES DÉJÀ CALCULÉES (fiables, ne les recalcule pas — appuie-toi dessus)\n${d.mesures}\n\n` : ""}L'ÉCHANGE${d.dureeMin ? ` (${d.dureeMin} minutes prévues)` : ""}
${d.echange}

Réponds en JSON strict :
{"criteres":[{"id":1,"note":6.5,"constat":"une phrase factuelle sur ce qui a été observé","citation":"les mots exacts du candidat, ou une chaîne vide","conseil":"une action concrète pour la prochaine fois"}]}
Un objet par critère, les ${retenus.length}, dans l'ordre.`;
}

/** Lit la réponse du modèle sans jamais faire confiance à sa forme. */
export function parseReponse(brut: string): unknown {
  const t = brut.trim();
  const debut = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    return JSON.parse(t.slice(debut, fin + 1));
  } catch {
    return null;
  }
}
