/**
 * Le mémoire, le rapport, la thèse : le document que le rapporteur a lu de
 * près — et sur lequel il interroge. Le texte extrait du PDF est conservé
 * (jamais le fichier) ; le modèle en tire les questions du rapporteur, qui
 * rejoignent celles du support dans la simulation et la soutenance blanche.
 */

import type { JuryQuestion } from "../slides/types";

export interface Rapport {
  nomFichier: string;
  pages: number;
  /** Texte extrait, borné. */
  texte: string;
  misAJourLe: string;
}

/** ~2 000 signes la page : 200 000 ≈ 100 pages de texte pur conservées au dépôt. */
export const LIMITES_RAPPORT = { texteChars: 200_000, envoiChars: 60_000, pagesMin: 3 } as const;

export function estRapport(v: unknown): v is Rapport {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.nomFichier === "string" && typeof r.pages === "number" && typeof r.texte === "string" && typeof r.misAJourLe === "string";
}

/**
 * Ce qu'on envoie : le début (introduction, problématique, méthode) et la fin
 * (résultats, limites, conclusion) — là où un rapporteur cherche ses questions
 * — quand le document dépasse la borne.
 */
export function extraitPourModele(texte: string, max: number = LIMITES_RAPPORT.envoiChars): string {
  const t = texte.trim();
  if (t.length <= max) return t;
  const debut = Math.round(max * 0.55);
  const fin = max - debut;
  return `${t.slice(0, debut)}\n\n[… ${t.length - max} caractères non transmis …]\n\n${t.slice(t.length - fin)}`;
}

export function construirePromptRapporteur(r: Pick<Rapport, "nomFichier" | "pages" | "texte">, nombre = 10): string {
  return `Tu es le RAPPORTEUR d'une soutenance dans une école d'ingénieurs : tu as lu le mémoire de près, et c'est toi qui poses les questions de fond. Le document (${r.pages} pages, « ${r.nomFichier} ») est reproduit ci-dessous, éventuellement tronqué au milieu.

MÉMOIRE :
${extraitPourModele(r.texte)}

Rédige exactement ${nombre} questions que tu poseras après la présentation. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour :
[
  { "question": "...", "pourquoi": "...", "categorie": "methode", "section": "3.2" }
]

Règles impératives :
- Chaque question est SPÉCIFIQUE au mémoire : elle cite un passage, un chiffre, un choix, une affirmation, un tableau, une absence notable. Une question posable à n'importe quel mémoire est interdite.
- Au moins trois questions pointent une faiblesse réelle : une affirmation non étayée, une méthode non justifiée, un résultat sans comparaison, une limite non discutée, une contradiction entre deux sections.
- Au moins deux questions demandent d'expliquer ou de justifier un choix (« pourquoi X plutôt que Y ? »).
- "pourquoi" : ce que le rapporteur cherche à vérifier, en une phrase. "section" : le numéro ou le titre de la section concernée, tel qu'il apparaît dans le document, ou "" si inconnu.
- "categorie" parmi : methode, technique, resultats, limites, contexte, suite.
- Français, vouvoiement, une à deux phrases par question. Aucune note, aucun score.`;
}

const CATEGORIES: readonly JuryQuestion["categorie"][] = ["methode", "technique", "resultats", "limites", "contexte", "suite"];

export function parseQuestionsRapporteur(brut: string): JuryQuestion[] | null {
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
  const liste = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { questions?: unknown }).questions) ? (parsed as { questions: unknown[] }).questions : null;
  if (!liste) return null;
  const vues = new Set<string>();
  const out: JuryQuestion[] = [];
  for (const item of liste) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.question !== "string" || o.question.trim().length < 10) continue;
    if (typeof o.pourquoi !== "string" || o.pourquoi.trim() === "") continue;
    const cle = o.question.trim().toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    const section = typeof o.section === "string" && o.section.trim() ? ` (§ ${o.section.trim().slice(0, 40)})` : "";
    out.push({
      id: `rapport-${out.length}`,
      question: o.question.trim(),
      pourquoi: o.pourquoi.trim() + (section ? ` — rapporteur${section}` : " — rapporteur"),
      categorie: CATEGORIES.includes(o.categorie as JuryQuestion["categorie"]) ? (o.categorie as JuryQuestion["categorie"]) : "methode",
    });
  }
  return out.length >= 3 ? out : null;
}

/** Empreinte du texte, pour la clé de cache des questions. */
export function empreinteRapport(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}-${texte.length}`;
}
