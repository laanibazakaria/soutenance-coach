/**
 * L'antisèche du jour J : une page qu'on emporte en salle de soutenance.
 *
 * Elle n'invente rien et ne coûte rien — elle rassemble ce que la préparation
 * a déjà produit et payé : l'accroche du pitch, le plan annoncé par les
 * diapositives, les chiffres que le jury a relevés en lisant le dossier, et
 * les fragilités sur lesquelles il compte attaquer. Jusqu'ici ces quatre
 * choses existaient dans quatre caches et aucun écran ne les montrait
 * ensemble — encore moins sur une feuille imprimable.
 */

import type { StorageLike } from "./types";
import { listeDeckSauvegarde } from "./slides/persistance";

export interface Antiseche {
  /** Les premières phrases de l'exposé, si un pitch a été généré. */
  accroche: string | null;
  /** Le plan tel que les diapositives l'annoncent. */
  plan: string[];
  /** Les chiffres à connaître par cœur — le jury les a relevés, il les redemandera. */
  chiffres: string[];
  /** Ce que le jury attaquera : préparer une réponse à chacune. */
  fragilites: string[];
}

export const LIMITES_ANTISECHE = { plan: 8, chiffres: 6, fragilites: 4 } as const;

const PREFIXE = "sc.ia.v1:";

/** Toutes les valeurs stockées sous un préfixe de cache — l'empreinte varie, pas l'usage. */
function valeursSous(storage: StorageLike, usage: string): unknown[] {
  const prefixe = `${PREFIXE}${usage}:`;
  const trouvees: unknown[] = [];
  // StorageLike n'expose pas d'itération : on passe par l'interface Web quand
  // elle est là (le navigateur), et on rend une liste vide sinon (les tests
  // fournissent un stockage complet, le serveur n'appelle jamais ceci).
  const st = storage as unknown as { length?: number; key?: (i: number) => string | null };
  if (typeof st.length !== "number" || typeof st.key !== "function") return trouvees;
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (!k || !k.startsWith(prefixe)) continue;
    try {
      trouvees.push(JSON.parse(storage.getItem(k) ?? "null"));
    } catch {
      // Une entrée corrompue n'empêche pas les autres d'exister.
    }
  }
  return trouvees;
}

const chaines = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max) : [];

/**
 * Rassemble l'antisèche depuis ce que l'appareil connaît déjà. Chaque section
 * est indépendante : sans pitch on garde les chiffres, sans lecture on garde
 * le plan — et sans rien du tout, l'appelant n'affiche simplement rien.
 */
export function construireAntiseche(storage: StorageLike): Antiseche | null {
  const deck = listeDeckSauvegarde(storage);
  const plan = deck ? deck.slides.map((s) => s.titre).filter(Boolean).slice(0, LIMITES_ANTISECHE.plan) : [];

  // La fiche de lecture du jury : ses chiffres et ses angles d'attaque.
  let chiffres: string[] = [];
  let fragilites: string[] = [];
  for (const v of valeursSous(storage, "appel-lecture:soutenance")) {
    const f = (v ?? {}) as Record<string, unknown>;
    const c = chaines(f.chiffres, LIMITES_ANTISECHE.chiffres);
    const g = chaines(f.fragilites, LIMITES_ANTISECHE.fragilites);
    // Plusieurs fiches peuvent coexister (un ancien dossier) : on garde la
    // plus fournie, faute de date pour départager.
    if (c.length + g.length > chiffres.length + fragilites.length) {
      chiffres = c;
      fragilites = g;
    }
  }

  // L'accroche du pitch, quelle que soit la durée pour laquelle il a été rédigé.
  let accroche: string | null = null;
  for (const v of valeursSous(storage, "pitch")) {
    const p = (v ?? {}) as Record<string, unknown>;
    if (typeof p.accroche === "string" && p.accroche.trim()) {
      accroche = p.accroche.trim();
      break;
    }
  }

  if (!accroche && plan.length === 0 && chiffres.length === 0 && fragilites.length === 0) return null;
  return { accroche, plan, chiffres, fragilites };
}
