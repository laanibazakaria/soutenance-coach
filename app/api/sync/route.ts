import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { estSessionRecord } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";
import type { Deck } from "@/lib/slides/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { estParcours, type Parcours } from "@/lib/parcours";

/**
 * Synchronisation des données d'un compte.
 *
 * GET  → tout ce que le serveur connaît de l'utilisateur.
 * PUT  → dépose ce que le navigateur a de nouveau (sessions, support,
 *        résultats IA). Idempotent : renvoyer deux fois la même session ne
 *        crée pas de doublon.
 *
 * Sans compte, ces routes répondent 401 et l'application reste locale.
 */

async function utilisateurCourant(): Promise<string | null> {
  if (!baseConfiguree()) return null;
  const session = await auth();
  return session?.user?.id ?? null;
}

function versRecord(s: {
  id: string;
  startedAt: Date;
  durationMs: number;
  transcript: string;
  wordCount: number;
  confidence: number | null;
  targetDurationMs: number | null;
}): SessionRecord {
  return {
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    durationMs: s.durationMs,
    transcript: s.transcript,
    wordCount: s.wordCount,
    ...(s.confidence !== null ? { confidence: s.confidence } : {}),
    ...(s.targetDurationMs !== null ? { targetDurationMs: s.targetDurationMs } : {}),
  };
}

export async function GET() {
  const userId = await utilisateurCourant();
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const [sessions, deck, ia, parcours] = await Promise.all([
    prisma.trainingSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" } }),
    prisma.deck.findUnique({ where: { userId } }),
    prisma.iaResult.findMany({ where: { userId } }),
    prisma.parcours.findUnique({ where: { userId } }),
  ]);

  return NextResponse.json({
    sessions: sessions.map(versRecord),
    // Le champ Json revient typé JsonValue : on le relit comme la structure écrite.
    deck: deck ? ({ nomFichier: deck.nomFichier, slides: deck.slides as unknown as Deck["slides"] }) : null,
    ia: Object.fromEntries(ia.map((r) => [r.cle, r.valeur])),
    parcours: parcours
      ? ({
          dateSoutenance: parcours.dateSoutenance,
          type: parcours.type as Parcours["type"],
          dureeMin: parcours.dureeMin,
          creeLe: parcours.creeLe,
          etapesFaites: parcours.etapesFaites as Record<string, string>,
          misAJourLe: parcours.misAJourLe.toISOString(),
        } satisfies Parcours)
      : null,
  });
}

interface CorpsPut {
  sessions?: unknown[];
  deck?: Deck | null;
  ia?: Record<string, unknown>;
  parcours?: unknown;
}

export async function PUT(request: Request) {
  const userId = await utilisateurCourant();
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  let corps: CorpsPut;
  try {
    corps = (await request.json()) as CorpsPut;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const sessions = (corps.sessions ?? []).filter(estSessionRecord);
  let ajoutees = 0;
  if (sessions.length > 0) {
    const resultat = await prisma.trainingSession.createMany({
      data: sessions.map((s) => ({
        id: s.id,
        userId,
        startedAt: new Date(s.startedAt),
        durationMs: s.durationMs,
        transcript: s.transcript,
        wordCount: s.wordCount,
        confidence: s.confidence,
        targetDurationMs: s.targetDurationMs,
      })),
      skipDuplicates: true,
    });
    ajoutees = resultat.count;
  }

  if (corps.deck && typeof corps.deck.nomFichier === "string" && Array.isArray(corps.deck.slides)) {
    await prisma.deck.upsert({
      where: { userId },
      create: { userId, nomFichier: corps.deck.nomFichier, slides: corps.deck.slides as unknown as Prisma.InputJsonValue },
      update: { nomFichier: corps.deck.nomFichier, slides: corps.deck.slides as unknown as Prisma.InputJsonValue },
    });
  }

  if (corps.ia && typeof corps.ia === "object") {
    const entrees = Object.entries(corps.ia).filter(([cle, v]) => cle.length <= 200 && v !== undefined);
    await Promise.all(
      entrees.map(([cle, valeur]) =>
        prisma.iaResult.upsert({
          where: { userId_cle: { userId, cle } },
          create: { userId, cle, valeur: valeur as Prisma.InputJsonValue },
          update: { valeur: valeur as Prisma.InputJsonValue },
        }),
      ),
    );
  }

  if (estParcours(corps.parcours)) {
    const p = corps.parcours;
    const donnees = {
      dateSoutenance: p.dateSoutenance,
      type: p.type,
      dureeMin: p.dureeMin,
      creeLe: p.creeLe,
      etapesFaites: p.etapesFaites as Prisma.InputJsonValue,
      misAJourLe: new Date(p.misAJourLe),
    };
    await prisma.parcours.upsert({ where: { userId }, create: { userId, ...donnees }, update: donnees });
  }

  return NextResponse.json({ ok: true, sessionsAjoutees: ajoutees });
}
