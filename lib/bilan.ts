/**
 * Le bilan : une photographie lisible de la préparation, à imprimer en PDF
 * ou à partager en lecture seule avec un encadrant. Construit depuis les
 * données locales ; aucune transcription complète n'y figure — des chiffres,
 * des tendances, des titres.
 */

import type { SessionRecord } from "./types";
import { computeReport } from "./scoring";
import { buildTrendReport, type TrendResult } from "./trends";
import { lireParcours, detecterContexte, type StorageEnumerable } from "./parcours/persistance";
import { construirePlan, dateDuJour, LIBELLES } from "./parcours";
import { listeDeckSauvegarde } from "./slides/persistance";
import { lireCache, cleCache } from "./ia-cache";
import { bilan as bilanFiches, type Fiche, type EtatFiche } from "./fiches";
import { lireModulesActifs, resumerModules, type ResumeModule } from "./preferences";
import { comparer, planPrevu } from "./repetition";
import type { Pitch } from "./pitch";

export interface LigneSession {
  date: string;
  dureeMin: number;
  mode: string;
  mots: number;
  debit?: number;
  bequilles?: number;
}

export interface Bilan {
  version: 1;
  genereLe: string;
  prenom?: string;
  modules: ResumeModule[];
  sessions: { total: number; minutesParlees: number; dernieres: LigneSession[] };
  tendances: TrendResult[];
  soutenance?: { type: string; dureeMin: number; date: string; joursRestants: number; pourcent: number; faites: number; total: number };
  support?: { nomFichier: string; slides: number; repetition?: { date: string; lignes: { numero: number; titre: string; prevuMs: number; reelMs: number; niveau: string }[]; resume: string } };
  fiches?: { total: number; acquises: number; dues: number };
}

export function construireBilan(storage: StorageEnumerable, sessions: SessionRecord[], prenom?: string, aujourdhui: string = dateDuJour()): Bilan {
  const actifs = lireModulesActifs(storage) ?? ["soutenance"];
  const modules = resumerModules(storage, sessions, actifs, aujourdhui);

  const dernieres: LigneSession[] = sessions.slice(0, 8).map((s) => {
    const r = computeReport({ transcript: s.transcript, durationMs: s.durationMs, confidence: s.confidence, targetDurationMs: s.targetDurationMs });
    const v = (id: string) => r.metrics.find((m) => m.id === id && m.level !== "absent")?.value;
    return { date: s.startedAt, dureeMin: Math.round(s.durationMs / 60000), mode: s.mode ?? "soutenance", mots: s.wordCount, debit: v("debit"), bequilles: v("bequilles") };
  });

  const sessionsSoutenance = sessions.filter((s) => !s.mode || s.mode === "soutenance");
  const bilan: Bilan = {
    version: 1,
    genereLe: new Date().toISOString(),
    ...(prenom ? { prenom } : {}),
    modules,
    sessions: { total: sessions.length, minutesParlees: Math.round(sessions.reduce((a, s) => a + s.durationMs, 0) / 60000), dernieres },
    tendances: sessionsSoutenance.length > 0 ? buildTrendReport(sessionsSoutenance).filter((t) => t.trend !== "absent") : [],
  };

  const p = lireParcours(storage);
  if (p) {
    const plan = construirePlan(p, detecterContexte(storage, sessions), aujourdhui);
    bilan.soutenance = { type: LIBELLES[p.type], dureeMin: p.dureeMin, date: p.dateSoutenance, joursRestants: plan.joursRestants, pourcent: plan.progression.pourcent, faites: plan.progression.faites, total: plan.progression.total };
  }

  const deck = listeDeckSauvegarde(storage);
  if (deck) {
    bilan.support = { nomFichier: deck.nomFichier, slides: deck.slides.length };
    const derniere = sessions.find((s) => s.slides && s.slides.length > 0);
    if (derniere && derniere.slides && derniere.targetDurationMs) {
      const textes = deck.slides.map((s) => s.texte);
      const pitch = lireCache<Pitch>(storage, cleCache("pitch", textes, String(Math.round(derniere.targetDurationMs / 60000))));
      const c = comparer(deck, planPrevu(deck, pitch, derniere.targetDurationMs).prevu, derniere.slides);
      bilan.support.repetition = { date: derniere.startedAt, lignes: c.lignes.map((l) => ({ numero: l.numero, titre: l.titre, prevuMs: l.prevuMs, reelMs: l.reelMs, niveau: l.niveau })), resume: c.resume };
    }
    const fiches = lireCache<Fiche[]>(storage, cleCache("fiches", deck.slides.map((s) => s.texte)));
    if (fiches) {
      const etats = lireCache<Record<string, EtatFiche>>(storage, cleCache("fiches-etats", deck.slides.map((s) => s.texte))) ?? {};
      const b = bilanFiches(fiches, etats, aujourdhui);
      bilan.fiches = { total: b.total, acquises: b.acquises, dues: b.dues };
    }
  }
  return bilan;
}

export function estBilan(v: unknown): v is Bilan {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return b.version === 1 && typeof b.genereLe === "string" && Array.isArray(b.modules) && typeof b.sessions === "object" && b.sessions !== null && Array.isArray(b.tendances);
}
