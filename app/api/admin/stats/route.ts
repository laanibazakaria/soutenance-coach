import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { moisCourant } from "@/lib/quota";

export const dynamic = "force-dynamic";

/** Statistiques d'usage — réservées à l'adresse ADMIN_EMAIL. Aucune transcription n'est renvoyée. */
export async function GET() {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Base non configurée." }, { status: 503 });
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || !process.env.ADMIN_EMAIL || email !== process.env.ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  }

  const depuis7j = new Date(Date.now() - 7 * 86_400_000);
  const mois = moisCourant();
  const [utilisateurs, nouveaux7j, sessions, sessions7j, decks, candidatures, profils, usage, interets, recents, parModule] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: depuis7j } } }),
    prisma.trainingSession.count(),
    prisma.trainingSession.count({ where: { createdAt: { gte: depuis7j } } }),
    prisma.deck.count(),
    prisma.candidature.count(),
    prisma.profilModule.groupBy({ by: ["module"], _count: { _all: true } }),
    prisma.usage.findMany({ where: { mois }, orderBy: { appels: "desc" } }),
    prisma.interet.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { name: true, email: true, createdAt: true, _count: { select: { trainingSessions: true } } } }),
    prisma.trainingSession.groupBy({ by: ["mode"], _count: { _all: true } }),
  ]);

  const appelsMois = usage.reduce((a, u) => a + u.appels, 0);
  return NextResponse.json({
    mois,
    utilisateurs: { total: utilisateurs, nouveaux7j },
    sessions: { total: sessions, derniers7j: sessions7j, parModule: Object.fromEntries(parModule.map((m) => [m.mode ?? "soutenance", m._count._all])) },
    supports: decks,
    candidatures,
    profils: Object.fromEntries(profils.map((p) => [p.module, p._count._all])),
    ia: { appelsMois, appelants: usage.length, comptes: usage.filter((u) => u.cle.startsWith("user:")).length, anonymes: usage.filter((u) => u.cle.startsWith("ip:")).length, top: usage.slice(0, 5).map((u) => ({ type: u.cle.startsWith("user:") ? "compte" : "anonyme", appels: u.appels })) },
    listeAttentePro: interets,
    recents: recents.map((u) => ({ nom: u.name, email: u.email, inscrit: u.createdAt.toISOString(), sessions: u._count.trainingSessions })),
  });
}
