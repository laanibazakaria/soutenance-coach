/**
 * Fiches à mémoriser : les chiffres, définitions, choix à justifier et
 * questions pièges tirés du support — ce qu'un étudiant doit savoir sans
 * regarder ses slides. Le modèle rédige les fiches (avec interdiction
 * d'inventer un chiffre absent du support) ; la révision espacée, elle,
 * est du code pur et testé.
 */

import type { Slide } from "../slides/types";

export type TypeFiche = "chiffre" | "definition" | "choix" | "piege";

export interface Fiche {
  id: string;
  type: TypeFiche;
  /** La question, telle qu'on se la pose (ou que le jury la pose). */
  recto: string;
  /** La réponse à connaître, telle qu'il faut la dire. */
  verso: string;
  /** Diapositive d'origine. */
  slide: number;
}

export const LIBELLES_TYPE: Record<TypeFiche, string> = {
  chiffre: "Chiffre clé",
  definition: "Définition",
  choix: "Choix à justifier",
  piege: "Question piège",
};

export const LIMITES_FICHES = { min: 6, max: 20, slidesChars: 6000 } as const;

/* ── Consigne et validation ── */

export function construirePromptFiches(slides: Pick<Slide, "numero" | "titre" | "texte">[]): string {
  let budget: number = LIMITES_FICHES.slidesChars;
  const blocs: string[] = [];
  for (const s of slides) {
    const bloc = `[Diapositive ${s.numero}] ${s.titre}\n${s.texte.trim()}`;
    if (bloc.length > budget) {
      blocs.push(bloc.slice(0, Math.max(0, budget)) + " […]");
      break;
    }
    blocs.push(bloc);
    budget -= bloc.length;
  }

  return `Tu es un coach de soutenance (école d'ingénieurs, Maroc/France). À partir des diapositives d'un étudiant, rédige les fiches de mémorisation qu'il doit connaître PAR CŒUR pour ne jamais sécher devant le jury.

DIAPOSITIVES :
${blocs.join("\n\n")}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises Markdown :
{
  "fiches": [
    { "type": "chiffre", "recto": "...", "verso": "...", "slide": 3 }
  ]
}

Types de fiches (mélange-les) :
- "chiffre" : un nombre ou une unité du support à connaître exactement. recto = la question (« Combien de … ? », « Quelle valeur de … ? »), verso = la valeur exacte et son contexte en une phrase.
- "definition" : un terme technique ou un sigle du support. recto = « Qu'est-ce que … ? », verso = la définition en une phrase, telle qu'il faut la dire à l'oral.
- "choix" : un choix de conception ou de méthode visible dans le support. recto = « Pourquoi … plutôt que … ? » ou « Pourquoi avoir … ? », verso = la justification attendue. Si le support ne donne pas la raison, verso = « À préparer : le support ne le dit pas. Pistes : … » avec une ou deux pistes.
- "piege" : une question piège probable sur une faiblesse ou une zone floue du support. recto = la question telle qu'un jury la poserait, verso = l'angle de réponse en une ou deux phrases.

Règles impératives :
- Entre ${LIMITES_FICHES.min} et ${LIMITES_FICHES.max} fiches. Chaque fiche cite la diapositive d'origine ("slide", entier).
- INTERDIT d'inventer un chiffre, un nom ou un résultat absent des diapositives. Si tu n'en as pas, fais moins de fiches "chiffre".
- Des questions précises à CE projet — aucune fiche posable à n'importe quel projet.
- recto : une phrase. verso : une à deux phrases, concrètes, en français, en tutoyant l'étudiant si tu t'adresses à lui.`;
}

const TYPES: readonly TypeFiche[] = ["chiffre", "definition", "choix", "piege"];

/**
 * Valide les fiches renvoyées. Refuse plutôt que de deviner ; tolère le JSON
 * entouré de texte. Les identifiants sont stables (dérivés du contenu) pour
 * que la progression survive à une régénération identique.
 */
export function parseFiches(brut: string, nbSlides: number): Fiche[] | null {
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(brut.slice(debut, fin + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const liste = (parsed as Record<string, unknown>).fiches;
  if (!Array.isArray(liste)) return null;

  const fiches: Fiche[] = [];
  const vus = new Set<string>();
  for (const f of liste) {
    if (typeof f !== "object" || f === null) continue;
    const o = f as Record<string, unknown>;
    if (!TYPES.includes(o.type as TypeFiche)) continue;
    if (typeof o.recto !== "string" || typeof o.verso !== "string") continue;
    const recto = o.recto.trim();
    const verso = o.verso.trim();
    if (!recto || !verso) continue;
    const slide = typeof o.slide === "number" && o.slide >= 1 && o.slide <= nbSlides ? Math.round(o.slide) : 0;
    const id = `f-${empreinteCourte(recto)}`;
    if (vus.has(id)) continue;
    vus.add(id);
    fiches.push({ id, type: o.type as TypeFiche, recto, verso, slide });
    if (fiches.length >= LIMITES_FICHES.max) break;
  }
  return fiches.length >= Math.min(LIMITES_FICHES.min, 3) ? fiches : null;
}

function empreinteCourte(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ── Révision espacée (boîtes de Leitner simplifiées) ── */

export interface EtatFiche {
  /** 0 = nouvelle ou ratée ; monte à chaque bonne réponse. */
  niveau: number;
  /** Prochaine révision, YYYY-MM-DD. */
  prochaine: string;
  vues: number;
  ratees: number;
}

/** Jours avant la prochaine révision après une bonne réponse, par niveau atteint. */
export const INTERVALLES = [1, 3, 7, 14] as const;
/** À partir de ce niveau, la fiche est considérée acquise. */
export const NIVEAU_ACQUIS = 3;

export type Resultat = "su" | "pas-su";

function ajouterJours(d: string, n: number): string {
  const [a, m, j] = d.split("-").map(Number);
  const t = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1, (j ?? 1) + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** L'état après une révision. Une fiche ratée revient aujourd'hui, niveau 0. */
export function reviser(etat: EtatFiche | undefined, resultat: Resultat, aujourdhui: string): EtatFiche {
  const base = etat ?? { niveau: 0, prochaine: aujourdhui, vues: 0, ratees: 0 };
  if (resultat === "pas-su") {
    return { niveau: 0, prochaine: aujourdhui, vues: base.vues + 1, ratees: base.ratees + 1 };
  }
  const niveau = Math.min(base.niveau + 1, INTERVALLES.length);
  return { niveau, prochaine: ajouterJours(aujourdhui, INTERVALLES[niveau - 1] ?? 14), vues: base.vues + 1, ratees: base.ratees };
}

/** Les fiches à revoir aujourd'hui : ratées d'abord, puis jamais vues, puis par échéance. */
export function fichesDues(fiches: Fiche[], etats: Record<string, EtatFiche>, aujourdhui: string): Fiche[] {
  const rang = (f: Fiche): [number, string] => {
    const e = etats[f.id];
    if (!e) return [1, aujourdhui];
    return [e.niveau === 0 && e.vues > 0 ? 0 : 2, e.prochaine];
  };
  return fiches
    .filter((f) => {
      const e = etats[f.id];
      return !e || e.prochaine <= aujourdhui;
    })
    .sort((a, b) => {
      const [ra, pa] = rang(a);
      const [rb, pb] = rang(b);
      return ra !== rb ? ra - rb : pa.localeCompare(pb);
    });
}

export interface Bilan {
  total: number;
  dues: number;
  acquises: number;
  /** Jamais révisées. */
  nouvelles: number;
  /** Les plus ratées (au moins une fois), les pires d'abord. */
  difficiles: Fiche[];
}

export function bilan(fiches: Fiche[], etats: Record<string, EtatFiche>, aujourdhui: string): Bilan {
  const difficiles = fiches
    .filter((f) => (etats[f.id]?.ratees ?? 0) > 0)
    .sort((a, b) => (etats[b.id]?.ratees ?? 0) - (etats[a.id]?.ratees ?? 0))
    .slice(0, 5);
  return {
    total: fiches.length,
    dues: fichesDues(fiches, etats, aujourdhui).length,
    acquises: fiches.filter((f) => (etats[f.id]?.niveau ?? 0) >= NIVEAU_ACQUIS).length,
    nouvelles: fiches.filter((f) => !etats[f.id]).length,
    difficiles,
  };
}
