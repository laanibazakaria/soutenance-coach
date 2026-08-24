"use client";

import { decouper, retrouver, contextePassages, LIMITES_MEMOIRE, type PassageVectorise } from "./index";
import { empreinte, lireIndex, sauverIndex, effacerIndex, type MemoireIndexee } from "./stockage";

/**
 * Côté navigateur : indexer le mémoire une fois, puis retrouver les bons
 * passages avant chaque question du jury. Les vecteurs restent ici ; le
 * serveur ne voit qu'un texte à la fois, jamais la collection.
 */

async function vectoriser(textes: string[]): Promise<number[][] | null> {
  try {
    const r = await fetch("/api/memoire/vecteurs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ textes }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { vecteurs?: number[][] };
    return j.vecteurs ?? null;
  } catch {
    return null;
  }
}

export interface ResultatIndexation {
  ok: boolean;
  passages: number;
  message?: string;
}

/**
 * Découpe le mémoire et calcule les vecteurs. Si le document n'a pas changé,
 * on ne refait rien : c'est gratuit et instantané.
 */
export async function indexerMemoire(texte: string, nomFichier: string, surAvancement?: (fait: number, total: number) => void): Promise<ResultatIndexation> {
  const marque = empreinte(texte);
  const existant = await lireIndex();
  if (existant?.empreinte === marque && existant.passages.length > 0) return { ok: true, passages: existant.passages.length };

  const passages = decouper(texte);
  if (passages.length === 0) return { ok: false, passages: 0, message: "Le document semble vide." };

  const vectorises: PassageVectorise[] = [];
  const LOT = 32;
  for (let i = 0; i < passages.length; i += LOT) {
    const lot = passages.slice(i, i + LOT);
    const vecteurs = await vectoriser(lot.map((p) => p.texte));
    if (!vecteurs) return { ok: false, passages: 0, message: "La lecture du mémoire n'a pas abouti. Réessaie dans un moment." };
    lot.forEach((p, k) => vectorises.push({ ...p, vecteur: vecteurs[k] ?? [] }));
    surAvancement?.(Math.min(i + LOT, passages.length), passages.length);
  }

  const index: MemoireIndexee = { empreinte: marque, nomFichier, passages: vectorises, indexeLe: new Date().toISOString() };
  await sauverIndex(index);
  return { ok: true, passages: vectorises.length };
}

export async function memoireIndexe(): Promise<MemoireIndexee | null> {
  return lireIndex();
}

export async function oublierMemoire(): Promise<void> {
  return effacerIndex();
}

/**
 * Les passages du mémoire les plus proches de ce qui vient d'être dit — à
 * remettre au jury pour qu'il interroge sur le document, pas sur des idées
 * générales. Renvoie null si le mémoire n'est pas indexé.
 */
export async function passagesPour(question: string, combien = LIMITES_MEMOIRE.retenus): Promise<string | null> {
  const index = await lireIndex();
  if (!index || index.passages.length === 0) return null;
  const propre = question.trim().slice(0, 1500);
  if (propre.length < 12) return null;
  const vecteurs = await vectoriser([propre]);
  const v = vecteurs?.[0];
  if (!v) return null;
  return contextePassages(retrouver(v, index.passages, combien));
}
