import type { SessionRecord } from "./types";

/**
 * La recherche de la barre du haut : pages et guides (index statique) et
 * sessions (transcriptions locales). Insensible à la casse et aux accents,
 * sans réseau. Pur et testé.
 */
export interface Page {
  titre: string;
  detail: string;
  lien: string;
  /** Mots supplémentaires sur lesquels la page doit remonter. */
  mots?: string;
}

export const PAGES: ReadonlyArray<Page> = [
  { titre: "Accueil", detail: "Ce que tu prépares, où tu en es", lien: "/app" },
  { titre: "La question du jour", detail: "Une question, une minute au micro", lien: "/app/question-du-jour", mots: "quotidien série rappel" },
  { titre: "Mes sessions", detail: "Toutes tes répétitions, l'avis du coach", lien: "/app/sessions", mots: "historique transcription export import" },
  { titre: "Mon bilan", detail: "Une photographie de ta préparation, à imprimer", lien: "/app/bilan", mots: "pdf partager encadrant" },
  { titre: "L'appel avec le jury IA", detail: "Il parle, tu réponds, il rebondit — en direct", lien: "/app/appel", mots: "simulation vocale entretien oral direct voix" },
  { titre: "Nouvelle session", detail: "Parle comme si le jury était en face", lien: "/app/session", mots: "enregistrer micro entraînement" },
  { titre: "Soutenance · parcours", detail: "Chaque jour, ce qu'il faut faire", lien: "/app/soutenance", mots: "pfa pfe mémoire thèse date j-x" },
  { titre: "Mes slides", detail: "Analyse, pitch, questions du jury", lien: "/app/slides", mots: "pdf support diapositives" },
  { titre: "Répéter avec mes slides", detail: "La diapositive à l'écran, un chrono par diapositive", lien: "/app/repetition", mots: "minutage" },
  { titre: "Fiches à mémoriser", detail: "Chiffres, définitions, pièges — par cœur", lien: "/app/fiches", mots: "leitner révision" },
  { titre: "Soutenance blanche", detail: "L'exposé, le jury qui enchaîne, le débrief", lien: "/app/soutenance-blanche", mots: "répétition générale" },
  { titre: "Le guide de la soutenance", detail: "Ce que le jury note vraiment, la veille, le jour J", lien: "/app/guide", mots: "erreurs voix regard corps stress" },
  { titre: "Entretien d'embauche", detail: "Le poste, l'offre, ton CV", lien: "/app/entretien", mots: "stage alternance emploi recruteur rh candidature" },
  { titre: "Le guide de l'entretien", detail: "Présentez-vous, la méthode STAR, le salaire", lien: "/app/guide-entretien", mots: "star salaire questions" },
  { titre: "Pitch de projet", detail: "Concours d'innovation, startup, hackathon", lien: "/app/m/pitch", mots: "innovation démo" },
  { titre: "Le guide du pitch", detail: "La structure en 3 minutes, la preuve avant la promesse", lien: "/app/guide-pitch" },
  { titre: "Oral de concours", detail: "Admission, master, bourse", lien: "/app/m/concours", mots: "admission école projet professionnel" },
  { titre: "Le guide de l'oral de concours", detail: "Se présenter, « pourquoi nous », l'actualité", lien: "/app/guide-concours" },
  { titre: "Les guides", detail: "Un guide par oral", lien: "/app/guides" },
  { titre: "Mon compte", detail: "Synchroniser sur tous tes appareils", lien: "/app/connexion", mots: "google connexion déconnexion supprimer" },
  { titre: "Forfaits", detail: "Ce qui est gratuit, ce que Pro apportera", lien: "/app/forfaits", mots: "quota ia prix pro" },
];

export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface ResultatSession {
  id: string;
  titre: string;
  extrait: string;
  lien: string;
}

export interface Resultats {
  pages: Page[];
  sessions: ResultatSession[];
}

const LIBELLES_MODE: Record<string, string> = { soutenance: "Soutenance", entretien: "Entretien", pitch: "Pitch", concours: "Concours" };

/** Cherche dans les pages et les sessions. Moins de 2 caractères : rien. */
export function rechercher(brut: string, sessions: SessionRecord[], pages: ReadonlyArray<Page> = PAGES, max = 5): Resultats {
  const q = normaliser(brut.trim());
  if (q.length < 2) return { pages: [], sessions: [] };
  const termes = q.split(/\s+/).filter(Boolean);
  const correspond = (texte: string) => {
    const t = normaliser(texte);
    return termes.every((m) => t.includes(m));
  };

  const pagesTrouvees = pages
    .map((p) => ({ p, score: correspond(p.titre) ? 2 : correspond(`${p.titre} ${p.detail} ${p.mots ?? ""}`) ? 1 : 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.p);

  const sessionsTrouvees = sessions
    .filter((s) => correspond(`${s.transcript} ${s.mode ?? "soutenance"}`))
    .slice(0, max)
    .map((s) => {
      const t = normaliser(s.transcript);
      const i = Math.max(0, t.indexOf(termes[0]));
      const debut = Math.max(0, i - 40);
      const extrait = (debut > 0 ? "…" : "") + s.transcript.slice(debut, debut + 110).trim() + (s.transcript.length > debut + 110 ? "…" : "");
      const date = new Date(s.startedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return { id: s.id, titre: `${LIBELLES_MODE[s.mode ?? "soutenance"] ?? "Session"} · ${date} · ${Math.round(s.durationMs / 60000)} min`, extrait, lien: `/app/sessions?q=${encodeURIComponent(brut.trim())}` };
    });

  return { pages: pagesTrouvees, sessions: sessionsTrouvees };
}
