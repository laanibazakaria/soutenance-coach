/**
 * Module Entretien d'embauche — pour les lauréats, les stages, l'alternance.
 *
 * Même discipline que la soutenance : une banque déterministe de questions
 * classiques (hors ligne, testée), des questions SPÉCIFIQUES générées depuis
 * le CV et l'offre, un recruteur IA qui donne un avis qualitatif sur chaque
 * réponse — jamais de note. Les mesures (longueur, hésitations, concret,
 * latence) viennent de `lib/jury/evaluation`, partagées.
 */

import type { AnalyseReponse } from "../jury/evaluation";
import type { SessionRecord } from "../types";
import { consigneLangue, type LangueCourte } from "../langue";

export type RoleRecruteur = "rh" | "technique";
export type TypeEntretien = "rh" | "technique" | "mixte";

export interface Candidature {
  poste: string;
  entreprise: string;
  typeEntretien: TypeEntretien;
  /** YYYY-MM-DD, facultatif. */
  dateEntretien?: string;
  /** L'offre d'emploi, collée telle quelle. */
  offre: string;
  /** Le texte extrait du CV (jamais le fichier). */
  cvTexte: string;
  cvNomFichier?: string;
  /** Étapes cochées : id → ISO 8601. */
  etapesFaites: Record<string, string>;
  misAJourLe: string;
}

export type CategorieEntretien =
  | "presentation"
  | "motivation"
  | "experience"
  | "competences"
  | "comportement"
  | "projection"
  | "technique"
  | "piege"
  | "pratique";

export interface QuestionEntretien {
  id: string;
  question: string;
  /** Ce que le recruteur cherche à vérifier. */
  pourquoi: string;
  /** Ce qu'une bonne réponse contient. */
  attendu: string;
  categorie: CategorieEntretien;
  cible: RoleRecruteur | "les-deux";
  source: "classique" | "ia";
}

export const LIBELLES_CATEGORIES_ENTRETIEN: Record<CategorieEntretien, string> = {
  presentation: "Présentation",
  motivation: "Motivation",
  experience: "Expérience",
  competences: "Compétences",
  comportement: "Comportement",
  projection: "Projection",
  technique: "Technique",
  piege: "Question piège",
  pratique: "Pratique",
};

export const LIBELLES_ROLE: Record<RoleRecruteur, string> = { rh: "Recruteur RH", technique: "Manager technique" };

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function estCandidature(v: unknown): v is Candidature {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.poste === "string" &&
    typeof c.entreprise === "string" &&
    (c.typeEntretien === "rh" || c.typeEntretien === "technique" || c.typeEntretien === "mixte") &&
    (c.dateEntretien === undefined || (typeof c.dateEntretien === "string" && RE_DATE.test(c.dateEntretien))) &&
    typeof c.offre === "string" &&
    typeof c.cvTexte === "string" &&
    (c.cvNomFichier === undefined || typeof c.cvNomFichier === "string") &&
    typeof c.etapesFaites === "object" &&
    c.etapesFaites !== null &&
    typeof c.misAJourLe === "string"
  );
}

/** Fusion entre appareils : champs du plus récent, union des étapes (date la plus ancienne). */
export function fusionnerCandidature(local: Candidature | null, distant: Candidature | null): Candidature | null {
  if (!local) return distant;
  if (!distant) return local;
  const base = local.misAJourLe >= distant.misAJourLe ? local : distant;
  const etapesFaites: Record<string, string> = { ...distant.etapesFaites };
  for (const [id, date] of Object.entries(local.etapesFaites)) {
    const e = etapesFaites[id];
    etapesFaites[id] = e && e < date ? e : date;
  }
  return { ...base, etapesFaites };
}

/* ── Banque classique ── */

type Brut = { q: string; pourquoi: string; attendu: string; cat: CategorieEntretien; cible: QuestionEntretien["cible"] };

const BANQUE: ReadonlyArray<Brut> = [
  { q: "Présentez-vous en deux minutes.", pourquoi: "La première impression, et ta capacité à choisir ce qui compte.", attendu: "Présent (qui tu es, ce que tu sais faire), passé (deux expériences qui le prouvent), futur (pourquoi ce poste). Deux minutes, pas une de plus.", cat: "presentation", cible: "les-deux" },
  { q: "Pourquoi ce poste, et pourquoi chez nous ?", pourquoi: "Vérifier que tu as choisi cette entreprise, pas envoyé cent candidatures.", attendu: "Deux faits précis sur l'entreprise (produit, projet, valeur), reliés à ce que tu cherches. Pas de flatterie.", cat: "motivation", cible: "les-deux" },
  { q: "Racontez-moi une réussite dont vous êtes fier.", pourquoi: "Voir ce que tu appelles réussite, et si tu sais raconter avec des faits.", attendu: "Méthode STAR : situation, tâche, action, résultat chiffré. Ton rôle à toi, pas celui de l'équipe.", cat: "experience", cible: "les-deux" },
  { q: "Parlez-moi d'un échec, et de ce que vous en avez tiré.", pourquoi: "Tester l'honnêteté et le recul — pas la perfection.", attendu: "Un vrai échec (pas « je suis trop perfectionniste »), ta part de responsabilité, ce que tu fais différemment depuis.", cat: "comportement", cible: "les-deux" },
  { q: "Décrivez une situation de désaccord ou de conflit, et comment vous l'avez gérée.", pourquoi: "Comment tu te comportes quand ça frotte.", attendu: "Les faits, ton écoute, la solution trouvée. Jamais de procès de l'autre.", cat: "comportement", cible: "rh" },
  { q: "Quels sont vos points forts ? Et un point à améliorer ?", pourquoi: "La lucidité sur soi.", attendu: "Deux forces prouvées par un exemple ; un point faible réel, en cours de travail, avec ce que tu fais pour.", cat: "comportement", cible: "rh" },
  { q: "Où vous voyez-vous dans trois à cinq ans ?", pourquoi: "Ta cohérence avec le poste — et si tu vas rester.", attendu: "Une direction, pas un titre : les compétences que tu veux construire, et en quoi ce poste y mène.", cat: "projection", cible: "rh" },
  { q: "Pourquoi vous, plutôt qu'un autre candidat ?", pourquoi: "Ta capacité à te vendre sans arrogance.", attendu: "Le croisement exact entre l'offre et ton parcours : deux ou trois points de correspondance concrets.", cat: "motivation", cible: "rh" },
  { q: "Comment travaillez-vous sous pression ou avec une deadline serrée ?", pourquoi: "La fiabilité.", attendu: "Un exemple précis, ta méthode (priorisation, communication), le résultat.", cat: "comportement", cible: "les-deux" },
  { q: "Quelles sont vos prétentions salariales ?", pourquoi: "Savoir si vous êtes dans la même zone — et si tu connais ta valeur.", attendu: "Une fourchette renseignée sur le marché pour ce poste et ce niveau, annoncée calmement, avec ouverture à discuter.", cat: "pratique", cible: "rh" },
  { q: "Quelle est votre disponibilité ?", pourquoi: "Logistique, mais révélateur de sérieux.", attendu: "Une date claire. Si tu as un engagement en cours (stage, préavis, soutenance), dis-le.", cat: "pratique", cible: "rh" },
  { q: "Avez-vous des questions pour nous ?", pourquoi: "Ton intérêt réel, et ta préparation.", attendu: "Deux ou trois questions sur le poste, l'équipe, les premiers mois — jamais « non ».", cat: "motivation", cible: "les-deux" },
  { q: "Expliquez-moi un trou ou un changement de direction dans votre parcours.", pourquoi: "Pas le juger : voir si tu l'assumes.", attendu: "Les faits, sans t'excuser, et ce que cette période t'a apporté.", cat: "piege", cible: "rh" },
  { q: "Parlez-moi du projet technique le plus complexe sur lequel vous avez travaillé.", pourquoi: "Mesurer ta profondeur réelle, au-delà des mots-clés du CV.", attendu: "Le problème, les contraintes, tes choix et leurs raisons, ce que tu referais autrement. Ton rôle précis.", cat: "technique", cible: "technique" },
  { q: "Un choix technique que vous regrettez ?", pourquoi: "Le recul, et l'honnêteté.", attendu: "Un vrai choix, pourquoi il semblait bon, ce qui l'a rendu mauvais, ce que tu as appris.", cat: "technique", cible: "technique" },
  { q: "Comment apprenez-vous une technologie que vous ne connaissez pas ?", pourquoi: "Ta méthode d'apprentissage — ce qui compte plus que la liste de technos.", attendu: "Un exemple récent, ta démarche (docs, projet test, source), le temps que ça a pris.", cat: "competences", cible: "technique" },
  { q: "Racontez-moi un bug difficile que vous avez résolu.", pourquoi: "La rigueur de ta démarche de diagnostic.", attendu: "Les symptômes, les hypothèses, comment tu as isolé la cause, la correction et ce qui empêche la récidive.", cat: "technique", cible: "technique" },
  { q: "Expliquez un concept technique de votre domaine à quelqu'un qui n'est pas technique.", pourquoi: "La communication — indispensable en équipe et face à un client.", attendu: "Une analogie juste, trois phrases, sans jargon, sans condescendance.", cat: "competences", cible: "technique" },
  { q: "Comment vous assurez-vous de la qualité de ce que vous livrez ?", pourquoi: "Tests, revue, mesure : la maturité professionnelle.", attendu: "Des pratiques concrètes que tu as réellement appliquées, avec un exemple.", cat: "technique", cible: "technique" },
  { q: "Comment estimez-vous le temps nécessaire pour une tâche ?", pourquoi: "Le réalisme et la communication sur les délais.", attendu: "Découpage, marge, et ce que tu fais quand tu vois que tu vas dépasser — prévenir tôt.", cat: "competences", cible: "technique" },
];

/** Les classiques pour un rôle donné, dans l'ordre de la banque. */
export function questionsClassiques(role: RoleRecruteur | "les-deux" = "les-deux"): QuestionEntretien[] {
  return BANQUE.filter((b) => role === "les-deux" || b.cible === "les-deux" || b.cible === role).map((b, i) => ({
    id: `c-${i}-${b.cat}`,
    question: b.q,
    pourquoi: b.pourquoi,
    attendu: b.attendu,
    categorie: b.cat,
    cible: b.cible,
    source: "classique",
  }));
}

/* ── Questions spécifiques (modèle) ── */

export const LIMITES_ENTRETIEN = { offreChars: 4000, cvChars: 6000 } as const;

function contexteCandidature(c: Pick<Candidature, "poste" | "entreprise" | "offre" | "cvTexte">): string {
  return `POSTE VISÉ : ${c.poste || "(non précisé)"}
ENTREPRISE : ${c.entreprise || "(non précisée)"}

OFFRE D'EMPLOI :
${c.offre.trim().slice(0, LIMITES_ENTRETIEN.offreChars) || "(non fournie)"}

CV DU CANDIDAT (texte extrait) :
${c.cvTexte.trim().slice(0, LIMITES_ENTRETIEN.cvChars) || "(non fourni)"}`;
}

const CATEGORIES: readonly CategorieEntretien[] = ["presentation", "motivation", "experience", "competences", "comportement", "projection", "technique", "piege", "pratique"];

export function construirePromptQuestionsEntretien(c: Candidature, nombre = 10): string {
  return `Tu es un recruteur expérimenté (RH et manager technique réunis) qui prépare l'entretien d'un candidat. Tu as sous les yeux l'offre et son CV.

${contexteCandidature(c)}

Rédige exactement ${nombre} questions que TU poserais à CE candidat pour CE poste. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour :
[
  { "question": "...", "pourquoi": "...", "attendu": "...", "categorie": "experience", "cible": "rh" }
]

Règles impératives :
- Chaque question est SPÉCIFIQUE : elle cite un élément du CV (une expérience, un projet, une technologie, une date) ou une exigence de l'offre. Une question posable à n'importe quel candidat est interdite.
- Au moins deux questions sur les ÉCARTS entre le CV et l'offre (une compétence demandée absente du CV, une expérience courte, un changement de direction) — posées avec respect, comme un bon recruteur.
- Au moins deux questions techniques de fond sur ce que le CV affirme (« vous indiquez X : expliquez-moi comment vous l'avez mis en œuvre »).
- "pourquoi" : ce que le recruteur vérifie, en une phrase. "attendu" : ce qu'une bonne réponse contient, en une ou deux phrases, concrètes.
- "categorie" parmi : ${CATEGORIES.join(", ")}. "cible" : "rh", "technique" ou "les-deux".
- Français, vouvoiement, une à deux phrases par question. Aucune note, aucun score.`;
}

export function parseQuestionsEntretien(brut: string): QuestionEntretien[] | null {
  const debut = Math.min(...[brut.indexOf("["), brut.indexOf("{")].filter((i) => i !== -1));
  if (!Number.isFinite(debut)) return null;
  const fin = Math.max(brut.lastIndexOf("]"), brut.lastIndexOf("}"));
  if (fin <= debut) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  const liste = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;
  if (!liste) return null;

  const vues = new Set<string>();
  const out: QuestionEntretien[] = [];
  for (const item of liste) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.question !== "string" || o.question.trim().length < 10) continue;
    if (typeof o.pourquoi !== "string" || o.pourquoi.trim() === "") continue;
    const cle = o.question.trim().toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    const categorie = CATEGORIES.includes(o.categorie as CategorieEntretien) ? (o.categorie as CategorieEntretien) : "experience";
    const cible = o.cible === "rh" || o.cible === "technique" ? o.cible : "les-deux";
    out.push({
      id: `ia-${out.length}`,
      question: o.question.trim(),
      pourquoi: o.pourquoi.trim(),
      attendu: typeof o.attendu === "string" && o.attendu.trim() ? o.attendu.trim() : "Une réponse concrète, appuyée sur un exemple de ton parcours.",
      categorie,
      cible,
      source: "ia",
    });
  }
  return out.length >= 3 ? out : null;
}

/* ── Évaluation d'une réponse par le recruteur ── */

export interface DemandeEvaluationEntretien {
  question: QuestionEntretien;
  reponse: string;
  role: RoleRecruteur;
  candidature?: Pick<Candidature, "poste" | "entreprise" | "offre" | "cvTexte">;
  langue?: LangueCourte;
}

export function construirePromptEvaluationEntretien(d: DemandeEvaluationEntretien, analyse: AnalyseReponse): string {
  const faits = analyse.constats
    .filter((c) => c.niveau !== "absent")
    .map((c) => `- ${c.message}`)
    .join("\n");
  const persona =
    d.role === "rh"
      ? "Tu es un recruteur RH : tu évalues la clarté, la motivation réelle, l'adéquation au poste, la structure (méthode STAR quand la question porte sur une expérience) et la concision."
      : "Tu es le manager technique qui recrute : tu évalues la profondeur réelle, la précision, l'honnêteté sur les limites, et la capacité à expliquer un choix.";
  return `${persona} Un candidat vient de répondre oralement à ta question ; sa réponse est transcrite automatiquement (ignore les fautes de transcription, juge le fond).
${d.candidature ? `\n${contexteCandidature(d.candidature)}\n` : ""}
QUESTION POSÉE :
${d.question.question}

CE QUE TU CHERCHES À VÉRIFIER :
${d.question.pourquoi}

CE QU'UNE BONNE RÉPONSE CONTIENT :
${d.question.attendu}

RÉPONSE DU CANDIDAT (transcription) :
${d.reponse.slice(0, 6000)}

MESURES DÉJÀ CALCULÉES (ne les recalcule pas, ne les contredis pas) :
${faits || "- aucune"}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "points_forts": ["..."],
  "points_faibles": ["..."],
  "attendu": "...",
  "relance": "..."
}

Règles impératives :
- AUCUNE note, AUCUN score, AUCUN pourcentage. Tu juges le fond, pas en chiffres.
- 1 à 3 éléments par liste, une phrase chacun, en français, en tutoyant le candidat.
- "attendu" : ce que tu espérais entendre, en t'appuyant sur le CV et l'offre si tu les as.
- "relance" : la question que tu poserais juste après cette réponse — celle qui creuse là où c'est flou.
- Exigeant mais bienveillant : l'objectif est d'être prêt le jour de l'entretien.${consigneLangue(d.langue)}`;
}

/* ── Checklist du module ── */

export interface ContexteEntretien {
  candidature: Candidature | null;
  sessions: SessionRecord[];
  questionsGenerees: boolean;
}

export interface EtapeEntretien {
  id: string;
  titre: string;
  pourquoi: string;
  action: string;
  lien: string;
  auto?: (c: ContexteEntretien) => boolean;
}

export const ETAPES_ENTRETIEN: readonly EtapeEntretien[] = [
  { id: "profil", titre: "Renseigne le poste, l'offre et ton CV", pourquoi: "Tout ce qui suit est personnalisé à partir de là : questions, simulation, avis du coach.", action: "Mon profil", lien: "/app/entretien#profil", auto: (c) => Boolean(c.candidature && (c.candidature.cvTexte.trim() || c.candidature.offre.trim())) },
  { id: "guide", titre: "Lis le guide de l'entretien", pourquoi: "Le déroulé, ce que le recruteur évalue, la méthode STAR, les erreurs qui éliminent.", action: "Lire le guide", lien: "/app/guide-entretien" },
  { id: "pitch", titre: "« Présentez-vous » en 2 minutes, chronométré", pourquoi: "La première question de tous les entretiens. Deux minutes, présent-passé-futur, par cœur.", action: "M'entraîner", lien: "/app/session?mode=entretien&format=2", auto: (c) => c.sessions.some((s) => s.mode === "entretien") },
  { id: "questions", titre: "Lis les questions que ce recruteur te posera", pourquoi: "Tirées de TON CV et de CETTE offre : les écarts, les affirmations à prouver.", action: "Voir les questions", lien: "/app/entretien#questions", auto: (c) => c.questionsGenerees },
  { id: "simulation", titre: "Simulation avec le recruteur IA", pourquoi: "Tu réponds au micro, il te dit ce qui manque et ce qu'il relancerait. Répondre dans sa tête ne compte pas.", action: "Lancer la simulation", lien: "/app/appel?mode=entretien" },
  { id: "questions-a-poser", titre: "Prépare tes trois questions pour eux", pourquoi: "« Avez-vous des questions ? » — « Non » est éliminatoire. Trois questions sur le poste, l'équipe, les premiers mois.", action: "Voir des exemples", lien: "/app/guide-entretien#questions-a-poser" },
  { id: "veille", titre: "La veille : relis, prépare, dors", pourquoi: "Trajet, tenue, CV imprimé, deux faits sur l'entreprise, ton pitch relu une fois.", action: "La veille, dans le guide", lien: "/app/guide-entretien#veille" },
];

export interface EtapeEntretienEtat extends EtapeEntretien {
  faite: boolean;
  source: "auto" | "manuel" | null;
}

export function etapesEntretien(ctx: ContexteEntretien): EtapeEntretienEtat[] {
  return ETAPES_ENTRETIEN.map((e) => {
    const manuel = ctx.candidature?.etapesFaites[e.id];
    const auto = e.auto?.(ctx) ?? false;
    return { ...e, faite: Boolean(manuel) || auto, source: manuel ? "manuel" : auto ? "auto" : null };
  });
}
