import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { estSessionRecord } from "@/lib/storage";
import type { SessionRecord, SlideTiming } from "@/lib/types";
import type { Deck } from "@/lib/slides/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { estParcours, type Parcours } from "@/lib/parcours";
import { estCandidature, type Candidature } from "@/lib/entretien";
import { estProfilModule, type ProfilModule } from "@/lib/modules";

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
  slides?: unknown;
  mode?: string | null;
}): SessionRecord {
  return {
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    durationMs: s.durationMs,
    transcript: s.transcript,
    wordCount: s.wordCount,
    ...(s.confidence !== null ? { confidence: s.confidence } : {}),
    ...(s.targetDurationMs !== null ? { targetDurationMs: s.targetDurationMs } : {}),
    ...(Array.isArray(s.slides) ? { slides: s.slides as SlideTiming[] } : {}),
    ...(s.mode === "entretien" || s.mode === "soutenance" || s.mode === "pitch" || s.mode === "concours" ? { mode: s.mode } : {}),
  };
}

export async function GET() {
  const userId = await utilisateurCourant();
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const [sessions, deck, ia, parcours, candidature, profils] = await Promise.all([
    prisma.trainingSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" } }),
    prisma.deck.findUnique({ where: { userId } }),
    prisma.iaResult.findMany({ where: { userId } }),
    prisma.parcours.findUnique({ where: { userId } }),
    prisma.candidature.findUnique({ where: { userId } }),
    prisma.profilModule.findMany({ where: { userId } }),
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
    candidature: candidature
      ? ({
          poste: candidature.poste,
          entreprise: candidature.entreprise,
          typeEntretien: candidature.typeEntretien as Candidature["typeEntretien"],
          ...(candidature.dateEntretien ? { dateEntretien: candidature.dateEntretien } : {}),
          offre: candidature.offre,
          cvTexte: candidature.cvTexte,
          ...(candidature.cvNomFichier ? { cvNomFichier: candidature.cvNomFichier } : {}),
          etapesFaites: candidature.etapesFaites as Record<string, string>,
          misAJourLe: candidature.misAJourLe.toISOString(),
        } satisfies Candidature)
      : null,
    profils: profils.map(
      (p) =>
        ({
          module: p.module as ProfilModule["module"],
          champs: p.champs as Record<string, string>,
          documentTexte: p.documentTexte,
          ...(p.documentNom ? { documentNom: p.documentNom } : {}),
          ...(p.date ? { date: p.date } : {}),
          etapesFaites: p.etapesFaites as Record<string, string>,
          misAJourLe: p.misAJourLe.toISOString(),
        }) satisfies ProfilModule,
    ),
  });
}

interface CorpsPut {
  sessions?: unknown[];
  deck?: Deck | null;
  ia?: Record<string, unknown>;
  parcours?: unknown;
  candidature?: unknown;
  profils?: unknown[];
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
        slides: s.slides ? (s.slides as unknown as Prisma.InputJsonValue) : undefined,
        mode: s.mode,
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

  if (estCandidature(corps.candidature)) {
    const c = corps.candidature;
    const donnees = {
      poste: c.poste,
      entreprise: c.entreprise,
      typeEntretien: c.typeEntretien,
      dateEntretien: c.dateEntretien ?? null,
      offre: c.offre,
      cvTexte: c.cvTexte,
      cvNomFichier: c.cvNomFichier ?? null,
      etapesFaites: c.etapesFaites as Prisma.InputJsonValue,
      misAJourLe: new Date(c.misAJourLe),
    };
    await prisma.candidature.upsert({ where: { userId }, create: { userId, ...donnees }, update: donnees });
  }

  if (Array.isArray(corps.profils)) {
    for (const p of corps.profils.filter(estProfilModule)) {
      const donnees = {
        champs: p.champs as Prisma.InputJsonValue,
        documentTexte: p.documentTexte,
        documentNom: p.documentNom ?? null,
        date: p.date ?? null,
        etapesFaites: p.etapesFaites as Prisma.InputJsonValue,
        misAJourLe: new Date(p.misAJourLe),
      };
      await prisma.profilModule.upsert({
        where: { userId_module: { userId, module: p.module } },
        create: { userId, module: p.module, ...donnees },
        update: donnees,
      });
    }
  }

  return NextResponse.json({ ok: true, sessionsAjoutees: ajoutees });
}
