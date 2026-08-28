/**
 * L'appel avec le jury IA : un vrai entretien à la voix, en direct. Le jury
 * pose une question, écoute la réponse, rebondit dessus — il ne lit pas une
 * liste. Ici : les personas, le contexte envoyé au modèle, les prompts de
 * chaque tour et du débrief, et leurs parseurs. Pur et testé ; la voix et
 * le micro vivent côté navigateur, l'appel au modèle côté serveur.
 */

export type ModeAppel = "soutenance" | "entretien";

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
};

export const DUREES_APPEL = [5, 10, 15] as const;
export const LIMITES_APPEL = { contexteChars: 7000, repliqueChars: 500, reponseChars: 3000, toursMax: 30 } as const;

/** Un membre du jury : sa fonction, ce qu'il cherche, et la voix qui le dit. */
export interface MembreJury {
  id: string;
  /** Comme on l'annonce à l'oral : « Le rapporteur ». */
  nom: string;
  /** Ce qu'il est, pour le modèle. */
  role: string;
  /** Son obsession — ce sur quoi il revient toujours. */
  obsession: string;
  /** Voix de synthèse : des timbres nettement différents. */
  voix: "grave" | "claire" | "vive" | "posee";
}

/**
 * Un vrai oral, ce sont plusieurs personnes qui ne cherchent pas la même
 * chose et qui se passent la parole. C'est ce qui le rend inconfortable —
 * et donc utile à répéter.
 */
export const MEMBRES: Record<ModeAppel, MembreJury[]> = {
  soutenance: [
    { id: "rapporteur", nom: "Le rapporteur", role: "le rapporteur, qui a lu le mémoire ligne à ligne", obsession: "la méthode, les chiffres, ce que le document dit vraiment — il cite des passages et relève les incohérences", voix: "grave" },
    { id: "presidente", nom: "La présidente du jury", role: "la présidente du jury, qui cadre la séance", obsession: "la contribution personnelle du candidat, la portée du travail, le respect du temps — elle pose les questions larges et recadre", voix: "claire" },
    { id: "encadrant", nom: "L'encadrant", role: "l'encadrant du stage, plutôt bienveillant", obsession: "ce que le candidat a fait lui-même, les difficultés rencontrées et comment il s'en est sorti — il tend des perches, mais n'accepte pas le flou", voix: "posee" },
    { id: "examinatrice", nom: "L'examinatrice externe", role: "une examinatrice extérieure, spécialiste du domaine du candidat", obsession: "le fond disciplinaire : elle interroge en spécialiste de la filière du candidat (indiquée dans son profil), pousse sur les concepts précis du sujet, les alternatives de l'état de l'art, et ce que le candidat comprend vraiment de ses propres outils", voix: "vive" },
  ],
  entretien: [
    { id: "rh", nom: "La chargée de recrutement", role: "la chargée de recrutement", obsession: "le parcours, la motivation pour CE poste, la disponibilité, le comportement en équipe", voix: "claire" },
    { id: "technique", nom: "Le manager technique", role: "le manager technique, futur responsable direct", obsession: "les compétences réelles : il demande des cas concrets, des choix techniques, ce qui a raté", voix: "grave" },
  ],
};

/** Le membre qui a parlé en dernier, d'après l'historique annoté. */
export function membrePrecedent(historique: Message[], membres: MembreJury[]): MembreJury | null {
  for (let i = historique.length - 1; i >= 0; i--) {
    const m = historique[i]!;
    if (m.role !== "assistant") continue;
    const trouve = membres.find((x) => m.membre === x.id);
    if (trouve) return trouve;
  }
  return null;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  /** Quel membre du jury parle (répliques du jury seulement). */
  membre?: string;
}

export interface ContexteAppel {
  mode: ModeAppel;
  /** Texte de contexte (slides, mémoire, CV + offre, dossier), déjà tronqué. */
  contexte: string;
  langue: "fr" | "en";
  dureeMin: number;
  /** L'échange en cours : sert à savoir qui a parlé en dernier. */
  historique: Message[];
  /** Questions posées lors d'appels PRÉCÉDENTS, à ne pas reposer. */
  dejaPosees?: string[];
  /** Tirée au sort par la route : fait varier qui ouvre et par quel angle. */
  graine?: number;
  /** La mémoire du jury : faiblesses, questions ratées et progrès des appels précédents. */
  souvenirs?: string;
}

/**
 * Par où le jury entre dans le sujet. Sans cela, le modèle attaque toujours
 * par le chiffre le plus visible du dossier, et deux appels se ressemblent.
 */
export const ANGLES_OUVERTURE = [
  "attaque par le chiffre le plus discutable du dossier",
  "attaque par une limite que le dossier n'assume pas",
  "attaque par le choix technique le moins justifié, en demandant l'alternative écartée",
  "attaque par ce que le candidat a fait lui-même, et pas son équipe ou un outil",
  "attaque par la portée : à qui ça sert vraiment, et qui s'en servirait demain",
  "attaque par la façon dont le travail a été vérifié : comment sait-on que c'est vrai",
  "attaque par un détail précis du dossier que peu de gens auraient remarqué",
] as const;

/** Assemble le contexte à partir de ce qu'on a, sans dépasser la limite. */
export function assemblerContexte(parties: Array<{ titre: string; texte?: string | null }>, max: number = LIMITES_APPEL.contexteChars): string {
  const utiles = parties.filter((p) => p.texte && p.texte.trim().length > 20).map((p) => ({ titre: p.titre, texte: p.texte!.trim() }));
  if (utiles.length === 0) return "";
  // Deux passes : chaque section reçoit d'abord une part égale, puis ce que
  // les petites n'utilisent pas revient aux grandes. Un mémoire de cent pages
  // ne doit pas être coupé pendant que dix diapositives gaspillent le budget.
  const allocation = utiles.map(() => 0);
  let reste = max;
  let affames = utiles.map((_, i) => i);
  while (reste > 0 && affames.length > 0) {
    const part = Math.floor(reste / affames.length);
    if (part === 0) break;
    let distribue = 0;
    const encore: number[] = [];
    for (const i of affames) {
      const besoin = utiles[i]!.texte.length - allocation[i]!;
      const donne = Math.min(part, besoin);
      allocation[i]! += donne;
      distribue += donne;
      if (allocation[i]! < utiles[i]!.texte.length) encore.push(i);
    }
    reste -= distribue;
    if (encore.length === affames.length && distribue === 0) break;
    affames = encore;
  }
  return utiles.map((p, i) => `## ${p.titre}\n${p.texte.slice(0, allocation[i])}`).join("\n\n");
}

/**
 * Le prompt d'un tour : qui compose le jury, ce qu'il sait, comment il parle.
 *
 * Rien d'écrit en dur dans la bouche du jury : une phrase d'ouverture donnée
 * en exemple, le modèle la récite mot pour mot, et tous les appels commencent
 * pareil. On décrit donc l'intention et on interdit explicitement les
 * formules toutes faites.
 */
export function construirePromptTour(c: ContexteAppel, ecouleS: number): string {
  const p = PERSONAS[c.mode];
  const membres = MEMBRES[c.mode];
  const totalS = c.dureeMin * 60;
  const resteS = Math.max(0, totalS - ecouleS);
  const phase = resteS <= 45 ? "conclusion" : c.historique.length === 0 ? "ouverture" : "milieu";
  const langue = c.langue === "en" ? "Speak English only." : "Tu parles uniquement en français, naturel, à l'oral (pas de listes, pas de markdown).";
  const precedent = membrePrecedent(c.historique, membres);
  const graine = Math.abs(Math.round(c.graine ?? 0));
  const ouvreur = membres[graine % membres.length]!;
  const angle = ANGLES_OUVERTURE[graine % ANGLES_OUVERTURE.length]!;
  const dejaPosees = (c.dejaPosees ?? []).slice(0, 25);

  return [
    `Tu joues TOUT un jury d'oral, en direct, à la voix. ${langue}`,
    `LE JURY (${membres.length} personnes distinctes, qui ne cherchent pas la même chose) :\n${membres.map((m) => `- ${m.id} — ${m.nom} : ${m.role}. Ce qui l'intéresse : ${m.obsession}.`).join("\n")}`,
    `À chaque tour, UNE SEULE personne parle. Choisis laquelle selon ce que le candidat vient de dire : celui dont c'est le domaine enchaîne. Fais tourner la parole, SAUF pour creuser : tant qu'une réponse reste vague, chiffrée sans protocole, ou à côté de la question, la même personne insiste — jusqu'à trois fois sur le même point, en resserrant à chaque fois. On ne change de sujet que lorsque la réponse est nette, ou que le candidat a reconnu qu'il ne sait pas. Elle reprend aussi la parole si le candidat n'a rien répondu (voir plus bas).${precedent ? ` La dernière personne à avoir parlé était « ${precedent.id} ».` : ""}`,
    `Axes à couvrir au fil de l'oral (pas dans l'ordre, pas tous) : ${p.axes.map((a, i) => `${i + 1}) ${a}`).join(" ; ")}.`,
    "COMMENT ON PARLE : une seule question à la fois, une ou deux phrases, comme à l'oral. Réagis à ce qui vient d'être dit : si c'est vague, demande un exemple ou un chiffre précis ; si ça contredit le dossier, relève-le calmement en citant le dossier ; si c'est solide, dis-le en trois mots et passe à autre chose. Ne donne jamais la réponse. Ne commente jamais la forme (débit, hésitations, « euh »).",
    // Le client envoie « (silence) » quand le candidat n'a rien dit. Sans
    // consigne, le modèle traitait ce vide comme une réponse : il enchaînait
    // une question plus dure, en tenant pour acquis ce qui n'avait jamais été
    // confirmé. Un jury, devant un blanc, relance — il n'empile pas.
    "SI LE CANDIDAT N'A RIEN DIT (sa dernière réponse est « (silence) » ou vide) : ne pose PAS de nouvelle question et n'ajoute aucun reproche. La même personne reprend la parole, reformule sa question plus simplement ou la découpe en deux, ou propose de passer à autre chose. Un silence n'est jamais un aveu : n'en déduis rien, et ne traite pas comme acquis ce que le candidat n'a pas dit.",
    // Le jury cite le dossier ligne à ligne, ce qui rend ses erreurs très
    // crédibles : une référence inventée ressemble trait pour trait à une
    // vraie. D'où l'exigence de ne citer que ce qu'on a sous les yeux.
    "CE QUE TU CITES : ne cite une page, une ligne ou un chiffre que s'il figure vraiment dans le dossier ci-dessous. Si tu n'es pas sûr, dis « il me semble que » ou demande au candidat de te le confirmer. Quand tu tires une conclusion de ce que tu as lu, pose-la comme une question (« dois-je comprendre que… ? ») et non comme un fait établi.",
    // Le critère 8 de la grille exige « ne se contredit pas d'une réponse à
    // l'autre » — encore faut-il que l'oral crée l'occasion de se contredire.
    // La mémoire du jury : c'est elle qui transforme des appels isolés en une
    // relation. On rouvre sur ce qui a été raté, on reconnaît ce qui a monté.
    c.souvenirs
      ? `TA MÉMOIRE DE CE CANDIDAT (appels précédents) :\n${c.souvenirs}\nCOMMENT T'EN SERVIR : à l'ouverture, le membre concerné REPREND la première question restée sans bonne réponse, en le disant simplement (« La dernière fois, vous n'aviez pas su me dire… je vous repose la question »). Au fil de l'appel, reviens sur les points encore faibles plutôt que d'explorer du neuf. Quand le candidat répond bien là où il avait échoué, dis-le en une phrase sobre (« Bien. Cette fois vous l'avez. ») avant d'enchaîner — jamais de compliment appuyé. Un progrès listé ci-dessus se confirme à l'oral avant d'être reconnu. Ne mentionne jamais de note ni de chiffre de la grille.`
      : "",
    "REVENIR SUR UN CHIFFRE : quand le candidat a donné un nombre, une date ou un pourcentage plus tôt dans l'échange, un AUTRE membre y revient quelques tours après, sous une autre forme — sans rappeler la valeur annoncée, et sans dire que c'est une vérification. S'il se contredit, relève l'écart calmement en citant ses deux réponses. S'il confirme, dis-le en trois mots et passe.",
    "INTERDIT : les formules de jury de théâtre. Ne dis jamais « Merci pour cette présentation », « Nous allons passer aux questions », « Pouvez-vous résumer en une phrase », ni aucune formule d'accueil passe-partout. Entre dans le vif du sujet comme quelqu'un qui a lu le dossier et qui a déjà une question en tête.",
    c.contexte
      ? `CE QUE TU AS SOUS LES YEUX — un extrait du dossier, pas le dossier entier. Cite mot pour mot ce qui suit ; au-delà, tu te souviens du sens, pas des numéros. N'invente jamais un numéro de page, de ligne, d'annexe ou de figure absent de cet extrait : demande plutôt au candidat de te dire où ça se trouve. Et ne te contredis pas d'un tour à l'autre sur un même détail.
${c.contexte}`
      : "Tu n'as pas de dossier : pose des questions générales de ce type d'oral, puis creuse ce que le candidat raconte.",
    dejaPosees.length > 0 ? `DÉJÀ POSÉ lors de précédents entraînements — trouve autre chose :\n${dejaPosees.map((q: string) => `- ${q}`).join("\n")}` : "",
    `Temps : ${Math.round(ecouleS / 60)} min écoulées sur ${c.dureeMin}.`,
    phase === "conclusion"
      ? 'C\'est la fin : la personne qui préside remercie, conclut en une phrase, et tu mets "fin" à true.'
      : phase === "ouverture"
        ? `C'est le tout début. C'est « ${ouvreur.id} » (${ouvreur.nom}) qui ouvre, avec SA première question, formulée à sa manière. ${c.souvenirs ? "Il ouvre sur la mémoire du candidat : la première question restée sans bonne réponse, ou le point le plus faible." : `Angle imposé pour cette fois : ${angle}.`} Pas de préambule, pas de politesses : la question, directement.`
        : "Continue l'oral.",
    `Réponds en JSON strict : {"membre": "${membres[0]!.id}", "replique": "ce que cette personne dit, tel quel", "fin": false}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface Tour {
  replique: string;
  fin: boolean;
  /** Identifiant du membre qui parle — toujours un membre connu du mode. */
  membre: string;
}

export function parseTour(brut: string, mode: ModeAppel = "soutenance"): Tour | null {
  try {
    const nettoye = brut.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const j = JSON.parse(nettoye) as { replique?: unknown; fin?: unknown; membre?: unknown };
    if (typeof j.replique !== "string" || j.replique.trim() === "") return null;
    const membres = MEMBRES[mode];
    const demande = typeof j.membre === "string" ? j.membre.trim().toLowerCase() : "";
    const trouve = membres.find((m) => m.id === demande);
    return {
      replique: j.replique.trim().slice(0, LIMITES_APPEL.repliqueChars),
      fin: j.fin === true,
      membre: (trouve ?? membres[0]!).id,
    };
  } catch {
    return null;
  }
}

/** Le membre par son identifiant, avec repli sur le premier du jury. */
export function membreParId(mode: ModeAppel, id: string | undefined): MembreJury {
  const membres = MEMBRES[mode];
  return membres.find((m) => m.id === id) ?? membres[0]!;
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
    c.souvenirs ? `LES APPELS PRÉCÉDENTS DE CE CANDIDAT :\n${c.souvenirs}\nSi l'échange d'aujourd'hui montre un progrès réel sur un point listé, dis-le dans le diagnostic — une phrase, factuelle. S'il a encore échoué au même endroit, dis-le aussi : c'est l'information la plus utile du débrief.` : "",
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
