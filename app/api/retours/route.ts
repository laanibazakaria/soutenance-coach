import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { validerRetourOral, regrouper, TYPES_ORAL, type TypeOral } from "@/lib/retours";

export const dynamic = "force-dynamic";

/** Un étudiant raconte son oral : les questions réellement posées. Anonyme, modéré avant publication. */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible sur ce déploiement." }, { status: 503 });
  let brut: unknown;
  try {
    brut = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const r = validerRetourOral(brut, new Date().getUTCFullYear());
  if (!r) return NextResponse.json({ erreur: "Il faut au moins une vraie question (12 caractères ou plus) et un type d'oral." }, { status: 400 });
  const cree = await prisma.retourOral.create({ data: { type: r.type, ecole: r.ecole, filiere: r.filiere, niveau: r.niveau, annee: r.annee, questions: r.questions, ressenti: r.ressenti ?? null, conseil: r.conseil ?? null } });
  return NextResponse.json({ ok: true, id: cree.id });
}

/** Les retours approuvés, regroupés par école et filière. */
export async function GET(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ groupes: [], total: 0 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const where = { approuve: true, ...(TYPES_ORAL.includes(type as TypeOral) ? { type: type as TypeOral } : {}) };
  const retours = await prisma.retourOral.findMany({ where, orderBy: { creeLe: "desc" }, take: 500 });
  const groupes = regrouper(retours.map((r) => ({ type: r.type as TypeOral, ecole: r.ecole, filiere: r.filiere, niveau: r.niveau, annee: r.annee, questions: r.questions as string[], conseil: r.conseil ?? undefined, ressenti: r.ressenti ?? undefined, creeLe: r.creeLe.toISOString() })));
  return NextResponse.json({ groupes, total: retours.length }, { headers: { "cache-control": "no-store" } });
}
