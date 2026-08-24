/**
 * Le mémoire découpé en passages, pour que le jury interroge sur TA page 34
 * plutôt que sur des généralités : chaque passage reçoit un vecteur, et
 * avant chaque question on retrouve les trois passages les plus proches de
 * ce qui vient d'être dit.
 *
 * Ce fichier est pur et testé : ni réseau, ni stockage, seulement du texte
 * et des nombres.
 */

export interface Passage {
  /** Rang du passage dans le document, à partir de 1. */
  numero: number;
  /** Titre de section deviné, s'il y en a un au-dessus du passage. */
  section: string | null;
  texte: string;
}

export interface PassageVectorise extends Passage {
  vecteur: number[];
}

export const LIMITES_MEMOIRE = {
  /** Un passage vise ~1 200 caractères : assez pour un raisonnement, assez court pour être cité. */
  cible: 1200,
  /** On ne coupe jamais en dessous : sinon on hache les phrases. */
  min: 400,
  /** Au-delà, on coupe même en pleine phrase. */
  max: 2000,
  /** Nombre de passages retenus pour une question. */
  retenus: 3,
  /** Plafond : un mémoire de 200 pages ne doit pas coûter 500 appels. */
  passagesMax: 120,
} as const;

/** Une ligne courte, sans ponctuation finale, qui ressemble à un titre de section. */
function estTitre(ligne: string): boolean {
  const l = ligne.trim();
  if (l.length < 3 || l.length > 90) return false;
  if (/[.;:!?]$/.test(l)) return false;
  return /^(chapitre|partie|section|annexe|introduction|conclusion|r[ée]sum[ée]|abstract|bibliographie|\d+[.)]|[IVX]+[.)])/i.test(l) || (l === l.toUpperCase() && /[A-ZÀ-Þ]{3}/.test(l));
}

/**
 * Coupe un texte en morceaux qui finissent, autant que possible, sur une fin
 * de phrase — et jamais au-delà du maximum.
 */
function couperTexte(texte: string, limites: typeof LIMITES_MEMOIRE): string[] {
  const morceaux: string[] = [];
  let reste = texte.trim();
  while (reste.length > limites.max) {
    const fenetre = reste.slice(0, limites.max);
    const coupure = Math.max(fenetre.lastIndexOf(". "), fenetre.lastIndexOf(".\n"), fenetre.lastIndexOf("! "), fenetre.lastIndexOf("? "), fenetre.lastIndexOf("."));
    const fin = coupure >= limites.min ? coupure + 1 : limites.max;
    morceaux.push(reste.slice(0, fin).trim());
    reste = reste.slice(fin).trim();
  }
  if (reste.length > 0) morceaux.push(reste);
  return morceaux;
}

/**
 * Découpe le mémoire en passages qui respectent les sections, en gardant le
 * titre au-dessus de chacun.
 */
export function decouper(texte: string, limites = LIMITES_MEMOIRE): Passage[] {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ titre: string | null; texte: string }> = [];
  let titre: string | null = null;
  let bloc = "";

  const fermer = () => {
    if (bloc.trim()) sections.push({ titre, texte: bloc.trim() });
    bloc = "";
  };
  for (const ligne of lignes) {
    if (estTitre(ligne)) {
      fermer();
      titre = ligne.trim();
      continue;
    }
    bloc += (bloc ? "\n" : "") + ligne;
  }
  fermer();

  const passages: Passage[] = [];
  for (const s of sections) {
    for (const morceau of couperTexte(s.texte, limites)) {
      if (passages.length >= limites.passagesMax) return passages;
      passages.push({ numero: passages.length + 1, section: s.titre, texte: morceau });
    }
  }
  return passages;
}

/**
 * Découpe un mémoire page par page : chaque passage sait d'où il vient, et le
 * jury peut dire « à la page 12, vous écrivez… » — ce qu'un vrai rapporteur
 * fait. C'est la voie normale, l'extraction PDF nous rendant des pages.
 */
export function decouperPages(pages: string[], limites = LIMITES_MEMOIRE): Passage[] {
  const passages: Passage[] = [];
  pages.forEach((contenu, i) => {
    const propre = (contenu ?? "").trim();
    if (propre.length < 40) return; // page de garde, page blanche, table des matières vide
    for (const morceau of couperTexte(propre, limites)) {
      if (passages.length >= limites.passagesMax) return;
      passages.push({ numero: passages.length + 1, section: `page ${i + 1}`, texte: morceau });
    }
  });
  return passages;
}

/** Similarité cosinus entre deux vecteurs de même taille. */
export function similarite(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let produit = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    produit += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return produit / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface PassageTrouve extends Passage {
  proximite: number;
}

/** Les passages les plus proches d'une question ou d'une réponse. */
export function retrouver(vecteurQuestion: number[], passages: PassageVectorise[], combien: number = LIMITES_MEMOIRE.retenus): PassageTrouve[] {
  return passages
    .map((p) => ({ numero: p.numero, section: p.section, texte: p.texte, proximite: similarite(vecteurQuestion, p.vecteur) }))
    .sort((a, b) => b.proximite - a.proximite)
    .slice(0, Math.max(0, combien))
    .filter((p) => p.proximite > 0);
}

/** Le bloc de contexte remis au jury : les passages, avec leur origine. */
export function contextePassages(trouves: PassageTrouve[]): string | null {
  if (trouves.length === 0) return null;
  const blocs = trouves.map((p) => `[Passage ${p.numero}${p.section ? ` — ${p.section}` : ""}]\n${p.texte}`);
  return `Extraits du mémoire du candidat, retrouvés pour cette question. Appuie-toi dessus, cite-les si besoin, et n'invente rien qui n'y figure pas :\n\n${blocs.join("\n\n")}`;
}
