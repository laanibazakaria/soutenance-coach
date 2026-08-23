/**
 * Répéter avec un ami : un lien lui ouvre une page « tu es le jury » — les
 * questions à poser (avec ce qu'une bonne réponse contient), un chrono, et
 * trois cases par réponse. Son retour revient dans la préparation. Pur et
 * testé ; le stockage réutilise la table des partages (expire).
 */

export interface QuestionAmi {
  question: string;
  pourquoi: string;
  attendu?: string;
}

export interface SeanceAmi {
  type: "ami";
  titre: string;
  persona: string;
  /** Durée conseillée par réponse, en secondes. */
  dureeS: number;
  questions: QuestionAmi[];
  retours: RetourAmi[];
  creeLe: string;
}

export interface RetourAmi {
  nom?: string;
  /** Par question : clair / complet / convaincant, et une remarque. */
  reponses: { clair: boolean; complet: boolean; convaincant: boolean; remarque?: string }[];
  commentaire?: string;
  recuLe: string;
}

export const LIMITES_AMI = { questionsMax: 12, retoursMax: 20, texteMax: 400, nomMax: 40 } as const;

export function estSeanceAmi(v: unknown): v is SeanceAmi {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return s.type === "ami" && typeof s.titre === "string" && typeof s.persona === "string" && typeof s.dureeS === "number" && Array.isArray(s.questions) && Array.isArray(s.retours) && typeof s.creeLe === "string";
}

/** Construit une séance à partir de ce que l'étudiant a préparé. */
export function construireSeance(titre: string, persona: string, dureeS: number, questions: QuestionAmi[], maintenant: Date = new Date()): SeanceAmi {
  const propres = questions
    .filter((q) => typeof q.question === "string" && q.question.trim().length >= 10)
    .slice(0, LIMITES_AMI.questionsMax)
    .map((q) => ({ question: q.question.trim().slice(0, LIMITES_AMI.texteMax), pourquoi: (q.pourquoi ?? "").trim().slice(0, LIMITES_AMI.texteMax), ...(q.attendu ? { attendu: q.attendu.trim().slice(0, LIMITES_AMI.texteMax) } : {}) }));
  return { type: "ami", titre: titre.trim().slice(0, 120) || "Répétition", persona: persona.slice(0, 60) || "Jury", dureeS: Math.min(180, Math.max(20, Math.round(dureeS) || 60)), questions: propres, retours: [], creeLe: maintenant.toISOString() };
}

/** Valide et nettoie un retour d'ami. Renvoie null si inexploitable. */
export function validerRetour(brut: unknown, nbQuestions: number, maintenant: Date = new Date()): RetourAmi | null {
  if (!brut || typeof brut !== "object") return null;
  const r = brut as Record<string, unknown>;
  if (!Array.isArray(r.reponses) || r.reponses.length !== nbQuestions) return null;
  const reponses = r.reponses.map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const remarque = typeof o.remarque === "string" ? o.remarque.trim().slice(0, LIMITES_AMI.texteMax) : "";
    return { clair: o.clair === true, complet: o.complet === true, convaincant: o.convaincant === true, ...(remarque ? { remarque } : {}) };
  });
  const nom = typeof r.nom === "string" ? r.nom.trim().slice(0, LIMITES_AMI.nomMax) : "";
  const commentaire = typeof r.commentaire === "string" ? r.commentaire.trim().slice(0, LIMITES_AMI.texteMax * 2) : "";
  return { reponses, ...(nom ? { nom } : {}), ...(commentaire ? { commentaire } : {}), recuLe: maintenant.toISOString() };
}

/** La synthèse des retours : par question, combien l'ont trouvée claire / complète / convaincante. */
export function synthese(seance: SeanceAmi): { nb: number; parQuestion: { question: string; clair: number; complet: number; convaincant: number; remarques: string[] }[]; commentaires: string[] } {
  const nb = seance.retours.length;
  const parQuestion = seance.questions.map((q, i) => {
    const r = seance.retours.map((x) => x.reponses[i]).filter(Boolean);
    return {
      question: q.question,
      clair: r.filter((x) => x.clair).length,
      complet: r.filter((x) => x.complet).length,
      convaincant: r.filter((x) => x.convaincant).length,
      remarques: r.map((x) => x.remarque).filter((x): x is string => Boolean(x)),
    };
  });
  return { nb, parQuestion, commentaires: seance.retours.map((r) => (r.nom ? `${r.nom} : ${r.commentaire ?? ""}` : r.commentaire ?? "")).filter((c) => c.trim() !== "" && !c.endsWith(": ")) };
}
