/**
 * Le parcours J-X : de « j'ai une date » à « je suis prêt ».
 *
 * L'étudiant donne sa date de soutenance ; l'application répartit un
 * catalogue d'étapes sur les jours qui restent, détecte automatiquement
 * celles que son activité prouve (sessions, support, pitch, questions), et
 * lui dit chaque jour quoi faire. Tout ici est pur et testé : aucune date
 * n'est lue depuis l'horloge, elle est passée en paramètre.
 */

import type { SessionRecord } from "../types";
import { computeReport } from "../scoring";
import { SEUILS_TENDANCES } from "../trends";

export type TypeSoutenance = "pfa" | "pfe" | "autre";

export interface Parcours {
  /** Date de la soutenance, YYYY-MM-DD (date locale de l'utilisateur). */
  dateSoutenance: string;
  type: TypeSoutenance;
  /** Durée de l'exposé visée, en minutes. */
  dureeMin: number;
  /** Jour de création du parcours, YYYY-MM-DD : le plan est réparti à partir de là. */
  creeLe: string;
  /** Étapes cochées à la main (ou marquées par une page) : id → ISO 8601. */
  etapesFaites: Record<string, string>;
  /** Dernière modification, ISO 8601 — sert à la fusion entre appareils. */
  misAJourLe: string;
}

export const DUREES: Record<TypeSoutenance, number> = { pfa: 15, pfe: 20, autre: 10 };
export const LIBELLES: Record<TypeSoutenance, string> = { pfa: "PFA", pfe: "PFE", autre: "Soutenance" };

/** Ce que l'application sait de l'activité de l'étudiant — sert à détecter les étapes faites. */
export interface Contexte {
  sessions: SessionRecord[];
  deckPresent: boolean;
  pitchGenere: boolean;
  questionsGenerees: boolean;
  /** Au moins un avis du coach demandé sur une session. */
  avisCoach: boolean;
  /** Au moins une fiche révisée. */
  fichesRevisees: boolean;
}

/** Position dans la fenêtre de préparation : fraction 0..1, ou un jour fixe. */
export type Position = number | "veille" | "jourJ";

export interface Etape {
  id: string;
  titre: string;
  pourquoi: string;
  action: string;
  lien: string;
  position: Position;
  /** Détection automatique : vrai si l'activité prouve que l'étape est faite. */
  auto?: (ctx: Contexte) => boolean;
  /** Sous-liste à afficher (checklist de la veille, du jour J). */
  details?: string[];
}

/** Tolérance de tenue du temps considérée « dans les temps ». */
export const TOLERANCE_TEMPS = 0.1;

function dansLesTemps(s: SessionRecord): boolean {
  if (!s.targetDurationMs) return false;
  return Math.abs(s.durationMs - s.targetDurationMs) / s.targetDurationMs <= TOLERANCE_TEMPS;
}

function bequillesSousControle(s: SessionRecord): boolean {
  const m = computeReport({
    transcript: s.transcript,
    durationMs: s.durationMs,
    confidence: s.confidence,
    targetDurationMs: s.targetDurationMs,
  }).metrics.find((x) => x.id === "bequilles");
  return m?.level === "bon";
}

/** Le catalogue, dans l'ordre pédagogique. Les textes sont la voix du coach. */
export const ETAPES: readonly Etape[] = [
  {
    id: "slides",
    titre: "Dépose tes slides",
    pourquoi:
      "Tout part de ton support : l'analyse repère les diapositives surchargées, et le pitch comme les questions du jury s'appuient sur son texte.",
    action: "Analyser mes slides",
    lien: "/app/slides",
    position: 0,
    auto: (c) => c.deckPresent,
  },
  {
    id: "guide",
    titre: "Lis le guide de la soutenance",
    pourquoi:
      "Dix minutes pour savoir comment ça se passe, ce que le jury note vraiment, et comment répondre à une question dont tu n'as pas la réponse. Tout ce qu'on apprend d'habitude après.",
    action: "Lire le guide",
    lien: "/app/guide",
    position: 0.05,
  },
  {
    id: "pitch",
    titre: "Génère ton pitch et lis-le à voix haute",
    pourquoi:
      "Un fil rouge écrit pour ton support : l'accroche, quoi dire sur chaque diapositive, les transitions. Le lire deux fois à voix haute vaut mieux que dix relectures silencieuses.",
    action: "Voir mon pitch",
    lien: "/app/slides",
    position: 0.1,
    auto: (c) => c.pitchGenere,
  },
  {
    id: "session1",
    titre: "Première répétition, sans pression",
    pourquoi:
      "Tu ne seras pas bon, et c'est normal : cette session est ton point de départ. Tout ce qui suit se mesure par rapport à elle.",
    action: "Lancer une session",
    lien: "/app/session",
    position: 0.15,
    auto: (c) => c.sessions.length >= 1,
  },
  {
    id: "questions",
    titre: "Lis les questions que le jury posera sur ton projet",
    pourquoi:
      "Elles citent tes chiffres, tes choix techniques, tes faiblesses. Les découvrir le jour J est la pire façon de les découvrir.",
    action: "Voir les questions",
    lien: "/app/slides",
    position: 0.3,
    auto: (c) => c.questionsGenerees,
  },
  {
    id: "fiches",
    titre: "Mémorise tes chiffres et tes définitions",
    pourquoi:
      "Des fiches tirées de tes slides — chiffres clés, définitions, choix à justifier, questions pièges. Sécher sur son propre chiffre devant le jury, c'est ce qui se voit le plus.",
    action: "Réviser mes fiches",
    lien: "/app/fiches",
    position: 0.4,
    auto: (c) => c.fichesRevisees,
  },
  {
    id: "session-chrono",
    titre: "Répétition chronométrée au format réel",
    pourquoi:
      "La durée exacte, pas une minute de plus : un jury coupe. Le minuteur passe à l'orange dans les 10 % finaux, au rouge au dépassement.",
    action: "Répéter en mode soutenance",
    lien: "/app/session",
    position: 0.45,
    auto: (c) => c.sessions.some((s) => Boolean(s.targetDurationMs)),
  },
  {
    id: "repetition-slides",
    titre: "Répète avec tes slides : le temps par diapositive",
    pourquoi:
      "Tes diapositives à l'écran, un chrono par diapositive comparé au minutage de ton pitch. C'est là qu'on découvre que la slide 2 mange trois minutes.",
    action: "Répéter avec mes slides",
    lien: "/app/repetition",
    position: 0.5,
    auto: (c) => c.sessions.some((s) => Boolean(s.slides && s.slides.length > 0)),
  },
  {
    id: "coach",
    titre: "Demande l'avis du coach sur une répétition",
    pourquoi:
      "Les chiffres disent comment tu parles ; le coach dit ce que tu as oublié de tes slides, ce qui était confus, et quoi dire autrement. Une fois suffit pour savoir quoi retravailler.",
    action: "Voir mes sessions",
    lien: "/app",
    position: 0.55,
    auto: (c) => c.avisCoach,
  },
  {
    id: "jury",
    titre: "Simulation d'entretien : réponds à voix haute",
    pourquoi:
      "Le jury pose, tu réponds au micro, et tu obtiens un avis sur chaque réponse — ce qui manque, ce qu'il relancerait. Répondre dans sa tête ne compte pas.",
    action: "Lancer la simulation",
    lien: "/app/jury",
    position: 0.6,
  },
  {
    id: "tendances",
    titre: "Trois sessions mesurées : tes tendances se débloquent",
    pourquoi:
      "À partir de trois sessions, le coach te dit ce qui progresse et ce qui stagne. Avant, ce serait juger sur du bruit.",
    action: "Nouvelle session",
    lien: "/app/session",
    position: 0.7,
    auto: (c) => c.sessions.length >= SEUILS_TENDANCES.minSessions,
  },
  {
    id: "session-temps",
    titre: "Une répétition dans les temps (± 10 %)",
    pourquoi:
      "Tenir la durée est le critère le plus visible pour un jury — et le premier qu'on perd sous stress.",
    action: "Répéter en mode soutenance",
    lien: "/app/session",
    position: 0.8,
    auto: (c) => c.sessions.some(dansLesTemps),
  },
  {
    id: "bequilles",
    titre: "Une session propre : béquilles sous contrôle",
    pourquoi:
      "« Euh », « du coup », « en fait » : une fois repérés, ils tombent vite. Une session avec le voyant vert, c'est l'objectif.",
    action: "Nouvelle session",
    lien: "/app/session",
    position: 0.85,
    auto: (c) => c.sessions.some(bequillesSousControle),
  },
  {
    id: "relecture",
    titre: "La veille : relis, ne répète plus",
    pourquoi:
      "Relis ton pitch, tes fiches et tes questions, puis arrête. Une dernière répétition la veille au soir fatigue plus qu'elle ne rassure.",
    action: "Relire la veille",
    lien: "/app/guide#veille",
    position: "veille",
    details: [
      "Pitch relu une fois, à voix basse",
      "Fiches révisées une dernière fois — surtout les difficiles",
      "Questions du jury relues — surtout celles sur les faiblesses",
      "Ordinateur chargé, slides sur une clé USB et en ligne",
      "Tenue prête, réveil réglé, couché tôt",
    ],
  },
  {
    id: "jourJ",
    titre: "Le jour J",
    pourquoi: "Arrive en avance, respire, et commence par ton accroche — tu la connais.",
    action: "Le jour J, dans le guide",
    lien: "/app/guide#jour-j",
    position: "jourJ",
    details: [
      "Arriver 20 minutes en avance",
      "Tester l'affichage des slides sur le matériel de la salle",
      "Eau à portée, regard vers le jury, pas vers l'écran",
      "Accroche → plan annoncé → conclusion claire",
      "Une question sans réponse ? « Je n'ai pas exploré ce point ; voici comment je l'aborderais… »",
    ],
  },
];

export type Etat = "faite" | "aujourdhui" | "retard" | "avenir";

export interface EtapePlanifiee extends Etape {
  jour: string;
  faite: boolean;
  /** "auto" : prouvée par l'activité ; "manuel" : cochée. */
  source: "auto" | "manuel" | null;
  etat: Etat;
}

export interface Plan {
  joursRestants: number;
  /** La date est passée. */
  passee: boolean;
  etapes: EtapePlanifiee[];
  /** Non faites et dues (aujourd'hui ou en retard), dans l'ordre du plan. */
  aFaire: EtapePlanifiee[];
  /** La première étape à venir non faite. */
  prochaine: EtapePlanifiee | null;
  progression: { faites: number; total: number; pourcent: number };
}

/* ── Dates (YYYY-MM-DD, sans fuseau : on raisonne en jours civils) ── */

function decomposer(d: string): [number, number, number] {
  const [a, m, j] = d.split("-").map(Number);
  return [a ?? 0, (m ?? 1) - 1, j ?? 1];
}

/** Nombre de jours de `a` à `b` (négatif si `b` est avant `a`). */
export function joursEntre(a: string, b: string): number {
  const [aa, am, aj] = decomposer(a);
  const [ba, bm, bj] = decomposer(b);
  return Math.round((Date.UTC(ba, bm, bj) - Date.UTC(aa, am, aj)) / 86_400_000);
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

export function ajouterJours(d: string, n: number): string {
  const [a, m, j] = decomposer(d);
  const t = new Date(Date.UTC(a, m, j + n));
  return `${t.getUTCFullYear()}-${deuxChiffres(t.getUTCMonth() + 1)}-${deuxChiffres(t.getUTCDate())}`;
}

/** La date civile locale de l'utilisateur, YYYY-MM-DD. */
export function dateDuJour(maintenant: Date = new Date()): string {
  return `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`;
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function estParcours(v: unknown): v is Parcours {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.dateSoutenance === "string" &&
    RE_DATE.test(p.dateSoutenance) &&
    (p.type === "pfa" || p.type === "pfe" || p.type === "autre") &&
    typeof p.dureeMin === "number" &&
    p.dureeMin > 0 &&
    typeof p.creeLe === "string" &&
    RE_DATE.test(p.creeLe) &&
    typeof p.etapesFaites === "object" &&
    p.etapesFaites !== null &&
    typeof p.misAJourLe === "string"
  );
}

/* ── Planification ── */

/**
 * Répartit le catalogue entre `creeLe` et la date de soutenance. Les deux
 * derniers jours sont réservés à la veille et au jour J ; le reste est
 * réparti proportionnellement. Sur une fenêtre très courte, tout tombe
 * aujourd'hui — c'est la réalité, pas un bug.
 */
export function construirePlan(p: Parcours, ctx: Contexte, aujourdhui: string): Plan {
  const fenetre = Math.max(0, joursEntre(p.creeLe, p.dateSoutenance));
  const joursRestants = joursEntre(aujourdhui, p.dateSoutenance);
  const repartis = Math.max(0, fenetre - 2);

  const etapes: EtapePlanifiee[] = ETAPES.map((e) => {
    let jour: string;
    if (e.position === "jourJ") jour = p.dateSoutenance;
    else if (e.position === "veille") jour = ajouterJours(p.dateSoutenance, -1);
    else jour = ajouterJours(p.creeLe, Math.round(e.position * repartis));
    if (joursEntre(p.creeLe, jour) < 0) jour = p.creeLe;
    if (joursEntre(jour, p.dateSoutenance) < 0) jour = p.dateSoutenance;

    const manuel = p.etapesFaites[e.id];
    const auto = e.auto?.(ctx) ?? false;
    const faite = Boolean(manuel) || auto;
    const source = manuel ? "manuel" : auto ? "auto" : null;
    const ecart = joursEntre(aujourdhui, jour);
    const etat: Etat = faite ? "faite" : ecart < 0 ? "retard" : ecart === 0 ? "aujourdhui" : "avenir";
    return { ...e, jour, faite, source, etat };
  });

  const comptees = etapes.filter((e) => e.position !== "jourJ");
  const faites = comptees.filter((e) => e.faite).length;

  return {
    joursRestants,
    passee: joursRestants < 0,
    etapes,
    aFaire: etapes.filter((e) => e.etat === "retard" || e.etat === "aujourdhui"),
    prochaine: etapes.find((e) => e.etat === "avenir") ?? null,
    progression: { faites, total: comptees.length, pourcent: Math.round((faites / comptees.length) * 100) },
  };
}

/**
 * Fusion entre deux appareils : les champs viennent du plus récent, les
 * étapes cochées sont l'union (une étape faite quelque part est faite —
 * on garde la date la plus ancienne).
 */
export function fusionnerParcours(local: Parcours | null, distant: Parcours | null): Parcours | null {
  if (!local) return distant;
  if (!distant) return local;
  const base = local.misAJourLe >= distant.misAJourLe ? local : distant;
  const etapesFaites: Record<string, string> = { ...distant.etapesFaites };
  for (const [id, date] of Object.entries(local.etapesFaites)) {
    const existante = etapesFaites[id];
    etapesFaites[id] = existante && existante < date ? existante : date;
  }
  return { ...base, etapesFaites };
}
