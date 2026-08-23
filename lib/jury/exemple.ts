/**
 * « Voici comment un excellent candidat répondrait » — un exemple de réponse
 * à CETTE question, sur CE projet, à dire en 40 à 60 secondes. On apprend
 * par l'exemple ; l'exemple s'appuie sur le dossier, jamais sur des faits
 * inventés, et dit quand il manque une information.
 */

import { consigneLangue, type LangueCourte } from "../langue";

export interface DemandeExemple {
  question: string;
  /** Ce que le jury cherche à vérifier. */
  pourquoi?: string;
  /** Le contexte : diapositives, CV + offre, dossier… */
  contexte?: string;
  /** Qui pose la question. */
  persona: string;
  /** La réponse que l'étudiant a donnée, pour marquer la différence. */
  reponseEtudiant?: string;
  langue?: LangueCourte;
}

export interface Exemple {
  /** La réponse modèle, telle qu'on la dirait à l'oral. */
  reponse: string;
  /** Pourquoi elle fonctionne — deux ou trois points. */
  pourquoi: string[];
  /** Ce que l'exemple a dû supposer faute d'information dans le dossier. */
  suppositions: string[];
}

export const LIMITES_EXEMPLE = { contexteChars: 6000, reponseChars: 2500 } as const;

export function construirePromptExemple(d: DemandeExemple): string {
  return `Tu es un coach d'oral. Un ${d.persona.toLowerCase()} a posé une question à un candidat. Rédige la réponse qu'un EXCELLENT candidat donnerait — à l'oral, en 40 à 60 secondes (80 à 140 mots), en s'appuyant UNIQUEMENT sur le dossier ci-dessous.
${d.contexte ? `\nDOSSIER DU CANDIDAT :\n${d.contexte.slice(0, LIMITES_EXEMPLE.contexteChars)}\n` : "\nDOSSIER : inconnu — l'exemple devra rester général et le dire.\n"}
QUESTION :
${d.question}
${d.pourquoi ? `\nCE QUE LE JURY VÉRIFIE :\n${d.pourquoi}\n` : ""}${d.reponseEtudiant ? `\nCE QUE LE CANDIDAT A RÉPONDU (pour t'en distinguer, sans le commenter) :\n${d.reponseEtudiant.slice(0, LIMITES_EXEMPLE.reponseChars)}\n` : ""}
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "reponse": "...",
  "pourquoi": ["...", "..."],
  "suppositions": ["..."]
}

Règles impératives :
- "reponse" : à la première personne, comme on parle — une structure nette (réponse directe, la raison, un fait ou un chiffre du dossier, une limite assumée si pertinent), sans jargon creux, sans formule de politesse longue.
- N'invente AUCUN fait, chiffre ou nom absent du dossier. Si une information manque, utilise un crochet [à compléter : …] dans la réponse et liste-la dans "suppositions". Vide si rien n'a été supposé.
- "pourquoi" : 2 ou 3 raisons pour lesquelles cette réponse convainc un ${d.persona.toLowerCase()} — concrètes, en tutoyant le candidat.
- Aucune note, aucun score, aucun commentaire sur la réponse du candidat.${consigneLangue(d.langue)}`;
}

export function parseExemple(brut: string): Exemple | null {
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.reponse !== "string" || o.reponse.trim().length < 40) return null;
  const liste = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, max) : []);
  const pourquoi = liste(o.pourquoi, 3);
  if (pourquoi.length === 0) return null;
  return { reponse: o.reponse.trim(), pourquoi, suppositions: liste(o.suppositions, 4) };
}

/** Clé de cache : une question + un contexte = un exemple. */
export function cleExemple(question: string, contexte?: string): string {
  const s = `${question}|${(contexte ?? "").slice(0, 2000)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `exemple:${(h >>> 0).toString(36)}`;
}
