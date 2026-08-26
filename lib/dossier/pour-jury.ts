/**
 * Le pont entre la relecture et l'appel.
 *
 * La relecture trouve les écarts entre la présentation et le rapport, et les
 * questions auxquelles le dossier ne répond pas. L'appel, lui, ne le savait
 * pas : le jury lisait le dossier brut et retrouvait — ou non — les mêmes
 * failles. Ici, ce que la relecture a établi est mis en forme pour entrer dans
 * le dossier que le jury lit : il attaque là où le dossier est faible, comme
 * un vrai rapporteur qui a préparé ses notes.
 */

import type { StorageLike } from "../types";
import type { Relecture, Incoherence } from "./relecture";
import { trierIncoherences } from "./relecture";

export const LIMITES_POUR_JURY = { incoherences: 5, manques: 4, chars: 2_400 } as const;

const PREFIXE = "sc.ia.v1:relecture:";

/**
 * La relecture mémorisée sur l'appareil, s'il y en a une. Plusieurs peuvent
 * coexister (un ancien dossier) : on prend la plus fournie, faute de date.
 */
export function derniereRelecture(storage: StorageLike): Relecture | null {
  const st = storage as unknown as { length?: number; key?: (i: number) => string | null };
  if (typeof st.length !== "number" || typeof st.key !== "function") return null;
  let meilleure: Relecture | null = null;
  let poids = -1;
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (!k || !k.startsWith(PREFIXE)) continue;
    try {
      const v = JSON.parse(storage.getItem(k) ?? "null") as { relecture?: Relecture } | null;
      const r = v?.relecture;
      if (!r || !Array.isArray(r.incoherences) || !Array.isArray(r.manques)) continue;
      const p = r.incoherences.length + r.manques.length;
      if (p > poids) {
        poids = p;
        meilleure = r;
      }
    } catch {
      // Une entrée corrompue n'empêche pas les autres d'exister.
    }
  }
  return meilleure;
}

const ligneEcart = (i: Incoherence): string =>
  `- ${i.quoi} : la présentation dit « ${i.presentation} », le rapport dit « ${i.rapport} ».`;

/**
 * Les notes du rapporteur, prêtes à rejoindre le dossier lu par le jury.
 * Vide quand la relecture n'a rien relevé : pas de section creuse.
 */
export function formaterPourJury(r: Relecture | null): string {
  if (!r) return "";
  const ecarts = trierIncoherences(r.incoherences).slice(0, LIMITES_POUR_JURY.incoherences);
  const manques = r.manques.slice(0, LIMITES_POUR_JURY.manques);
  if (ecarts.length === 0 && manques.length === 0) return "";
  const parties: string[] = ["## Notes du rapporteur (relecture croisée des deux documents)"];
  if (ecarts.length > 0) {
    parties.push(
      "Contradictions relevées entre la présentation et le rapport — à faire clarifier par le candidat :",
      ...ecarts.map(ligneEcart),
    );
  }
  if (manques.length > 0) {
    parties.push(
      "Questions auxquelles le dossier ne répond nulle part — à poser :",
      ...manques.map((m) => `- ${m.question}`),
    );
  }
  return parties.join("\n").slice(0, LIMITES_POUR_JURY.chars);
}
