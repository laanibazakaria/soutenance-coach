/**
 * Le moteur de modules d'oral : une définition (profil, banque classique,
 * personas, checklist) décrit une situation — pitch de projet devant un jury
 * d'innovation, oral de concours ou d'admission — et le même moteur produit
 * les questions spécifiques, la simulation et la checklist.
 *
 * Même discipline que partout : banque déterministe testée, questions IA
 * qui doivent citer le dossier, mesures par du code, jamais de note.
 */

import type { AnalyseReponse } from "../jury/evaluation";
import type { SessionRecord } from "../types";
import type { QuestionEntretien, CategorieEntretien } from "../entretien";
import { consigneLangue, type LangueCourte } from "../langue";

export type ModuleId = "pitch" | "concours";

export interface ChampModule {
  id: string;
  label: string;
  placeholder?: string;
  type: "text" | "textarea";
  /** Affiché dans le contexte envoyé au modèle sous ce titre. */
  titreContexte: string;
  requis?: boolean;
}

export interface EtapeModule {
  id: string;
  titre: string;
  pourquoi: string;
  action: string;
  /** Lien relatif au module : remplacé par le bon préfixe. */
  lien: string;
  auto?: (ctx: ContexteModule) => boolean;
}

export interface ModuleOral {
  id: ModuleId;
  nom: string;
  /** Libellé de section dans la navigation. */
  section: string;
  /** Nom du hub dans la navigation. */
  hub: string;
  description: string;
  emoji: string;
  champs: ChampModule[];
  /** Libellé du document PDF facultatif. */
  documentLabel: string;
  dateLabel: string;
  /** Durée de la présentation chronométrée, en minutes. */
  formatMinutes: number;
  /** Titre de l'exercice chronométré. */
  formatTitre: string;
  /** Consigne de l'exercice chronométré (structure attendue). */
  formatConsigne: string;
  /** Qui pose les questions. */
  persona: string;
  /** Ce que ce jury évalue — injecté dans les consignes. */
  criteres: string;
  banque: ReadonlyArray<{ q: string; pourquoi: string; attendu: string; cat: CategorieEntretien }>;
  etapes: readonly EtapeModule[];
  guide: string;
}

export interface ProfilModule {
  module: ModuleId;
  champs: Record<string, string>;
  documentTexte: string;
  documentNom?: string;
  /** YYYY-MM-DD, facultatif. */
  date?: string;
  etapesFaites: Record<string, string>;
  misAJourLe: string;
}

export interface ContexteModule {
  profil: ProfilModule | null;
  sessions: SessionRecord[];
  questionsGenerees: boolean;
}

const ETAPES_COMMUNES = (m: { formatTitre: string; formatMinutes: number; id: ModuleId; preparationTitre: string; preparationPourquoi: string; preparationLien: string }): EtapeModule[] => [
  { id: "profil", titre: "Décris ton projet et dépose ton dossier", pourquoi: "Tout ce qui suit est personnalisé à partir de là : questions, simulation, avis du coach.", action: "Mon profil", lien: "#profil", auto: (c) => Boolean(c.profil && (c.profil.documentTexte.trim() || Object.values(c.profil.champs).some((v) => v.trim()))) },
  { id: "guide", titre: "Lis le guide", pourquoi: "Le déroulé, ce que ce jury évalue, les erreurs qui coûtent cher.", action: "Lire le guide", lien: "guide" },
  { id: "pitch", titre: `${m.formatTitre}, chronométré (${m.formatMinutes} min)`, pourquoi: "La structure par cœur, le temps tenu. Le coach compare ensuite ce que tu as dit à ton dossier.", action: "M'entraîner", lien: `/app/session?mode=${m.id}&format=${m.formatMinutes}`, auto: (c) => c.sessions.some((s) => s.mode === m.id) },
  { id: "questions", titre: "Lis les questions que ce jury te posera", pourquoi: "Tirées de TON dossier : les chiffres à prouver, les zones floues, les choix à justifier.", action: "Voir les questions", lien: "#questions", auto: (c) => c.questionsGenerees },
  { id: "simulation", titre: "L'appel avec le jury IA", pourquoi: "Il parle, tu réponds au micro, il rebondit sur ce que tu viens de dire — puis le débrief.", action: "Lancer l'appel", lien: "appel" },
  { id: "preparation", titre: m.preparationTitre, pourquoi: m.preparationPourquoi, action: "Voir dans le guide", lien: m.preparationLien },
  { id: "veille", titre: "La veille : relis, prépare, dors", pourquoi: "Matériel, trajet, dossier relu, présentation dite une fois à voix haute — puis stop.", action: "La veille, dans le guide", lien: "guide#veille" },
];

export const MODULES: Record<ModuleId, ModuleOral> = {
  pitch: {
    id: "pitch",
    nom: "Pitch de projet",
    section: "Pitch de projet",
    hub: "Mon pitch",
    description: "Concours d'innovation, startup, hackathon, jury de financement.",
    emoji: "🚀",
    champs: [
      { id: "projet", label: "Nom du projet *", placeholder: "Ex. : SoutenanceCoach", type: "text", titreContexte: "PROJET", requis: true },
      { id: "contexte", label: "Devant qui ?", placeholder: "Concours d'innovation de l'école, jury d'incubateur, hackathon…", type: "text", titreContexte: "CONTEXTE DU PITCH" },
      { id: "description", label: "Le projet en quelques lignes", placeholder: "Le problème, pour qui, la solution, ce qui existe déjà (prototype, utilisateurs, chiffres), l'équipe, ce que vous demandez.", type: "textarea", titreContexte: "DESCRIPTION DU PROJET" },
    ],
    documentLabel: "Ton dossier ou tes slides de pitch (PDF)",
    dateLabel: "Date du pitch",
    formatMinutes: 3,
    formatTitre: "Ton pitch",
    formatConsigne: "Problème → solution → preuve (ce qui existe déjà) → marché et différence → équipe → ce que tu demandes. Trois minutes, une phrase d'accroche au début, une demande claire à la fin.",
    persona: "Jury d'innovation",
    criteres: "la clarté du problème et pour qui, la preuve (prototype, utilisateurs, chiffres réels), la différence avec ce qui existe, le réalisme du modèle économique et du plan, la crédibilité de l'équipe, la franchise sur les risques, et des réponses directes — un jury d'innovation ou un investisseur n'a pas de temps pour le flou.",
    banque: [
      { q: "Quel problème résolvez-vous, et pour qui précisément ?", pourquoi: "Si le problème est flou, tout le reste l'est.", attendu: "Une personne précise, une situation précise, ce que ça lui coûte aujourd'hui. Un exemple vécu vaut un marché.", cat: "presentation" },
      { q: "Pourquoi maintenant ? Pourquoi personne ne l'a fait avant ?", pourquoi: "Le timing et la connaissance du terrain.", attendu: "Ce qui a changé (technologie, usage, réglementation) et ce que vous savez que les autres ignorent.", cat: "motivation" },
      { q: "Qu'est-ce qui existe déjà aujourd'hui ? Un prototype, des utilisateurs, des chiffres ?", pourquoi: "La preuve. Une idée ne vaut rien, une traction vaut tout.", attendu: "Des faits : nombre d'utilisateurs, retours, tests, ce qui marche et ce qui ne marche pas encore.", cat: "experience" },
      { q: "Qui sont vos concurrents, et pourquoi vous choisirait-on ?", pourquoi: "« Nous n'avons pas de concurrent » est éliminatoire.", attendu: "Deux ou trois alternatives (y compris « ne rien faire »), et une différence concrète, pas un adjectif.", cat: "technique" },
      { q: "Qui paie, combien, et pourquoi ?", pourquoi: "Le modèle économique, ou l'absence de modèle.", attendu: "Le client (pas forcément l'utilisateur), le prix envisagé et une raison de payer. « On verra » est une réponse, si elle est assumée avec un plan.", cat: "competences" },
      { q: "Quel est le plus gros risque de votre projet ?", pourquoi: "La lucidité. Un porteur qui ne voit pas de risque n'a pas regardé.", attendu: "Le vrai risque (technique, marché, équipe), et ce que vous faites pour le réduire — pas pour le nier.", cat: "piege" },
      { q: "Pourquoi vous ? Qu'est-ce qui rend votre équipe crédible sur ce sujet ?", pourquoi: "Un jury investit dans des gens.", attendu: "Les compétences complémentaires, ce que chacun a déjà fait, et ce qui manque — dit franchement.", cat: "comportement" },
      { q: "Que feriez-vous avec le prix / le financement, concrètement, dans les six mois ?", pourquoi: "Le plan — et si l'argent sert à quelque chose de précis.", attendu: "Trois actions datées et chiffrées, et l'objectif mesurable au bout.", cat: "projection" },
      { q: "Comment mesurez-vous que ça marche ?", pourquoi: "Les indicateurs révèlent si vous pensez produit ou idée.", attendu: "Un ou deux indicateurs simples (usage, rétention, revenus), leur valeur actuelle, la cible.", cat: "competences" },
      { q: "Et si un grand acteur décide de faire la même chose demain ?", pourquoi: "La défendabilité.", attendu: "Ce qui est difficile à copier (données, communauté, distribution, vitesse) — ou l'aveu que ce n'est pas défendable mais que le marché est assez grand.", cat: "piege" },
      { q: "Est-ce techniquement faisable ? Qu'est-ce qui n'est pas encore résolu ?", pourquoi: "Séparer ce qui marche de ce qui est promis.", attendu: "Ce qui tourne, ce qui est en cours, ce qui est une hypothèse. Sans enrober.", cat: "technique" },
      { q: "Qu'avez-vous appris de vos premiers utilisateurs qui vous a surpris ?", pourquoi: "Avez-vous vraiment parlé à des utilisateurs ?", attendu: "Un fait précis qui a changé quelque chose dans le produit.", cat: "experience" },
      { q: "Quelle est votre demande, exactement ?", pourquoi: "Un pitch sans demande est une présentation.", attendu: "Une phrase : ce que vous voulez (montant, accompagnement, accès), et ce que ça permettra.", cat: "pratique" },
    ],
    etapes: ETAPES_COMMUNES({
      id: "pitch",
      formatTitre: "Ton pitch",
      formatMinutes: 3,
      preparationTitre: "Ta phrase d'accroche et ta demande finale, par cœur",
      preparationPourquoi: "Le jury retient la première phrase et la dernière. Tout le reste peut trembler, pas celles-là.",
      preparationLien: "guide#structure",
    }),
    guide: "/app/guide-pitch",
  },
  concours: {
    id: "concours",
    nom: "Oral de concours",
    section: "Oral de concours",
    hub: "Mon oral",
    description: "Admission en école ou en master, bourse, concours avec entretien de motivation.",
    emoji: "🏛️",
    champs: [
      { id: "programme", label: "Établissement / programme visé *", placeholder: "Ex. : Master IA, École X, bourse Y", type: "text", titreContexte: "PROGRAMME VISÉ", requis: true },
      { id: "format", label: "Format de l'oral", placeholder: "Ex. : 20 min, jury de 3, présentation de 5 min puis questions", type: "text", titreContexte: "FORMAT DE L'ORAL" },
      { id: "motivation", label: "Ton projet et ta motivation en quelques lignes", placeholder: "Pourquoi ce programme, ce que tu veux en faire, ton parcours en deux phrases, ce qui te rend légitime — et ce qui te manque.", type: "textarea", titreContexte: "PROJET ET MOTIVATION DU CANDIDAT" },
    ],
    documentLabel: "Ta lettre de motivation, ton CV ou ton dossier (PDF)",
    dateLabel: "Date de l'oral",
    formatMinutes: 3,
    formatTitre: "Ta présentation",
    formatConsigne: "Qui tu es (parcours en deux phrases) → pourquoi ce programme, précisément → ton projet après → ce que tu apporteras. Trois minutes, concret, sans réciter ta lettre.",
    persona: "Jury d'admission",
    criteres: "la cohérence entre le parcours, le programme et le projet professionnel, la motivation réelle (des faits précis sur le programme), la culture du domaine et son actualité, la maturité et l'honnêteté sur les points faibles du dossier, la capacité à argumenter une opinion, et la clarté — un jury d'admission cherche quelqu'un qui sait pourquoi il est là.",
    banque: [
      { q: "Présentez-vous et votre parcours en deux minutes.", pourquoi: "Ce que tu choisis de dire, et comment tu structures.", attendu: "Parcours en deux phrases, un ou deux faits marquants, et le lien avec ce programme. Pas la lecture du CV.", cat: "presentation" },
      { q: "Pourquoi ce programme, et pas un autre ?", pourquoi: "Distinguer un choix d'un repli.", attendu: "Deux ou trois faits précis sur le programme (cours, enseignants, partenariats, débouchés) reliés à ton projet.", cat: "motivation" },
      { q: "Quel est votre projet professionnel, et en quoi ce programme y mène-t-il ?", pourquoi: "La cohérence — le critère numéro un.", attendu: "Une direction claire, deux étapes, et le rôle exact du programme dedans.", cat: "projection" },
      { q: "Qu'est-ce qui vous rend légitime pour ce programme ? Et qu'est-ce qui vous manque ?", pourquoi: "La lucidité sur soi.", attendu: "Deux forces prouvées, un manque réel et ce que tu fais pour le combler.", cat: "comportement" },
      { q: "Parlez-moi d'une réussite, puis d'un échec.", pourquoi: "Les faits derrière le dossier, et le recul.", attendu: "Méthode STAR pour chacune ; pour l'échec, ta responsabilité et ce que tu as changé.", cat: "experience" },
      { q: "Quelle actualité de votre domaine vous a marqué récemment, et pourquoi ?", pourquoi: "Ta curiosité réelle et ta culture du domaine.", attendu: "Un fait précis et daté, ce qu'il change, ton avis argumenté.", cat: "competences" },
      { q: "Qu'apporterez-vous à la promotion ?", pourquoi: "Le collectif compte autant que l'individu.", attendu: "Quelque chose de concret : une compétence, une expérience, un engagement — pas « ma motivation ».", cat: "comportement" },
      { q: "Si vous n'êtes pas admis, que ferez-vous ?", pourquoi: "Tester la solidité du projet et l'absence de dépendance.", attendu: "Un plan B réel qui garde la même direction — sans dramatiser, sans dire que c'est pareil.", cat: "piege" },
      { q: "Expliquez ce point faible de votre dossier.", pourquoi: "Le jury a vu la note, l'année, le trou. Il veut voir comment tu l'assumes.", attendu: "Les faits, sans t'excuser, ce que tu en as tiré, et ce qui montre que c'est derrière toi.", cat: "piege" },
      { q: "Quelles sont vos références dans ce domaine — lectures, personnes, travaux ?", pourquoi: "La profondeur de ton intérêt.", attendu: "Deux ou trois références précises que tu connais vraiment, et ce qu'elles t'ont apporté.", cat: "competences" },
      { q: "Où vous voyez-vous dans dix ans ?", pourquoi: "L'ambition et sa cohérence.", attendu: "Une direction, pas un titre — et le lien avec ce que tu demandes aujourd'hui.", cat: "projection" },
      { q: "Avez-vous une question pour nous ?", pourquoi: "Ta préparation et ton intérêt.", attendu: "Une ou deux questions précises sur le programme, le rythme, ce qui fait réussir un étudiant ici.", cat: "pratique" },
    ],
    etapes: ETAPES_COMMUNES({
      id: "concours",
      formatTitre: "Ta présentation",
      formatMinutes: 3,
      preparationTitre: "Trois faits sur le programme et une actualité du domaine",
      preparationPourquoi: "« Pourquoi nous ? » et « quelle actualité ? » tombent à chaque oral. Deux questions qui se préparent en une heure — et qui éliminent quand elles ne le sont pas.",
      preparationLien: "guide#pourquoi-nous",
    }),
    guide: "/app/guide-concours",
  },
};

export const IDS_MODULES: readonly ModuleId[] = ["pitch", "concours"];

export function estModuleId(v: unknown): v is ModuleId {
  return v === "pitch" || v === "concours";
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function estProfilModule(v: unknown): v is ProfilModule {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    estModuleId(p.module) &&
    typeof p.champs === "object" && p.champs !== null && Object.values(p.champs as object).every((x) => typeof x === "string") &&
    typeof p.documentTexte === "string" &&
    (p.documentNom === undefined || typeof p.documentNom === "string") &&
    (p.date === undefined || (typeof p.date === "string" && RE_DATE.test(p.date))) &&
    typeof p.etapesFaites === "object" && p.etapesFaites !== null &&
    typeof p.misAJourLe === "string"
  );
}

export function fusionnerProfil(local: ProfilModule | null, distant: ProfilModule | null): ProfilModule | null {
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

/** Résout le lien d'une étape vers le préfixe du module. */
export function lienEtape(m: ModuleOral, lien: string): string {
  if (lien.startsWith("/")) return lien;
  if (lien.startsWith("#")) return `/app/m/${m.id}${lien}`;
  if (lien.startsWith("guide")) return `${m.guide}${lien.slice(5)}`;
  if (lien === "appel" || lien === "simulation") return `/app/appel?mode=${m.id}`;
  return `/app/m/${m.id}/${lien}`;
}

export function questionsClassiquesModule(m: ModuleOral): QuestionEntretien[] {
  return m.banque.map((b, i) => ({
    id: `c-${m.id}-${i}`,
    question: b.q,
    pourquoi: b.pourquoi,
    attendu: b.attendu,
    categorie: b.cat,
    cible: "les-deux",
    source: "classique",
  }));
}

export const LIMITES_MODULE = { champChars: 3000, documentChars: 6000 } as const;

export function contexteProfil(m: ModuleOral, p: Pick<ProfilModule, "champs" | "documentTexte">): string {
  const blocs = m.champs.map((c) => `${c.titreContexte} : ${(p.champs[c.id] ?? "").trim().slice(0, LIMITES_MODULE.champChars) || "(non précisé)"}`);
  blocs.push(`DOSSIER (texte extrait du PDF) :\n${p.documentTexte.trim().slice(0, LIMITES_MODULE.documentChars) || "(non fourni)"}`);
  return blocs.join("\n\n");
}

export function construirePromptQuestionsModule(m: ModuleOral, p: ProfilModule, nombre = 10): string {
  return `Tu es un ${m.persona.toLowerCase()} expérimenté. Tu évalues ${m.criteres} Tu as sous les yeux le dossier d'un candidat.

${contexteProfil(m, p)}

Rédige exactement ${nombre} questions que TU poserais à CE candidat après sa présentation. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour :
[
  { "question": "...", "pourquoi": "...", "attendu": "...", "categorie": "experience", "cible": "les-deux" }
]

Règles impératives :
- Chaque question est SPÉCIFIQUE : elle cite un élément du dossier (un chiffre, un choix, une affirmation, une date, une absence notable). Une question posable à n'importe quel candidat est interdite.
- Au moins deux questions qui pointent une faiblesse, une zone floue ou une contradiction du dossier — posées avec respect, comme un bon jury.
- Au moins deux questions de fond qui obligent à prouver une affirmation (« vous écrivez X : montrez-le »).
- "pourquoi" : ce que le jury vérifie, en une phrase. "attendu" : ce qu'une bonne réponse contient, concrète, en une ou deux phrases.
- "categorie" parmi : presentation, motivation, experience, competences, comportement, projection, technique, piege, pratique.
- Français, vouvoiement, une à deux phrases par question. Aucune note, aucun score.`;
}

export interface DemandeEvaluationModule {
  question: QuestionEntretien;
  reponse: string;
  profil?: Pick<ProfilModule, "champs" | "documentTexte">;
  langue?: LangueCourte;
}

export function construirePromptEvaluationModule(m: ModuleOral, d: DemandeEvaluationModule, analyse: AnalyseReponse): string {
  const faits = analyse.constats
    .filter((c) => c.niveau !== "absent")
    .map((c) => `- ${c.message}`)
    .join("\n");
  return `Tu es un ${m.persona.toLowerCase()}. Tu évalues ${m.criteres} Un candidat vient de répondre oralement à ta question ; sa réponse est transcrite automatiquement (ignore les fautes de transcription, juge le fond).
${d.profil ? `\n${contexteProfil(m, d.profil)}\n` : ""}
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
- "attendu" : ce que tu espérais entendre, en t'appuyant sur le dossier si tu l'as.
- "relance" : la question que tu poserais juste après — celle qui creuse là où c'est flou.
- Exigeant mais bienveillant : l'objectif est d'être prêt le jour J.${consigneLangue(d.langue)}`;
}

export interface EtapeModuleEtat extends EtapeModule {
  faite: boolean;
  source: "auto" | "manuel" | null;
  href: string;
}

export function etapesModule(m: ModuleOral, ctx: ContexteModule): EtapeModuleEtat[] {
  return m.etapes.map((e) => {
    const manuel = ctx.profil?.etapesFaites[e.id];
    const auto = e.auto?.(ctx) ?? false;
    return { ...e, faite: Boolean(manuel) || auto, source: manuel ? "manuel" : auto ? "auto" : null, href: lienEtape(m, e.lien) };
  });
}
