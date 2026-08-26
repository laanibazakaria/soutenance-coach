/**
 * Les mesures déterministes qui accompagnent la grille.
 *
 * Le critère « Clarté de l'expression » exige « peu de mots béquilles » — et
 * le modèle les estimait au flair, alors que le code sait les compter. Le
 * paramètre `mesures` de la grille existait pour ça et restait vide depuis le
 * retrait de la caméra. Ici on le remplit avec ce que le code établit
 * exactement : des chiffres que le prompt marque « fiables, ne les recalcule
 * pas ».
 */

import { countFillers, tokenize } from "../scoring";

/** La ligne de mesures pour le prompt de la grille. Vide si trop court pour compter. */
export function mesuresPourGrille(parole: string, dureeMs: number): string {
  const mots = tokenize(parole);
  if (mots.length < 30) return "";
  const lignes: string[] = [`Le candidat a prononcé ${mots.length} mots.`];

  const minutes = dureeMs / 60_000;
  if (minutes >= 0.5) {
    lignes.push(`Débit : ${Math.round(mots.length / minutes)} mots par minute (zone confortable : 110 à 160).`);
  }

  const bequilles = countFillers(parole);
  const total = bequilles.reduce((n, f) => n + f.count, 0);
  const pourCent = Math.round((total / mots.length) * 1000) / 10;
  const detail = bequilles
    .slice(0, 3)
    .map((f) => `« ${f.filler} » ×${f.count}`)
    .join(", ");
  lignes.push(
    total === 0
      ? "Mots béquilles : aucun relevé."
      : `Mots béquilles : ${total} (${pourCent} pour 100 mots)${detail ? ` — ${detail}` : ""}.`,
  );
  return lignes.join("\n");
}
