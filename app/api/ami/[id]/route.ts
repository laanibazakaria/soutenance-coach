import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { estSeanceAmi, validerRetour, LIMITES_AMI, type SeanceAmi } from "@/lib/ami";

async function charger(id: string): Promise<{ seance: SeanceAmi; expire: Date } | null> {
  if (!baseConfiguree() || !/^[a-z0-9]{12}$/.test(id)) return null;
  const p = await prisma.partage.findUnique({ where: { id } });
  if (!p || p.expire <= new Date() || !estSeanceAmi(p.contenu)) return null;
  return { seance: p.contenu, expire: p.expire };
}

/** La séance (questions + retours). Lisible par quiconque a le lien. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await charger(id);
  if (!c) return NextResponse.json({ erreur: "Lien expiré ou inconnu." }, { status: 404 });
  return NextResponse.json({ seance: c.seance, expire: c.expire.toISOString() }, { headers: { "cache-control": "no-store" } });
}

/** L'ami dépose son retour. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await charger(id);
  if (!c) return NextResponse.json({ erreur: "Lien expiré ou inconnu." }, { status: 404 });
  let brut: unknown;
  try {
    brut = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const retour = validerRetour(brut, c.seance.questions.length);
  if (!retour) return NextResponse.json({ erreur: "Retour incomplet : une ligne par question." }, { status: 400 });
  if (c.seance.retours.length >= LIMITES_AMI.retoursMax) return NextResponse.json({ erreur: "Cette séance a déjà reçu le maximum de retours." }, { status: 409 });
  const seance: SeanceAmi = { ...c.seance, retours: [...c.seance.retours, retour] };
  await prisma.partage.update({ where: { id }, data: { contenu: seance as object } });
  return NextResponse.json({ ok: true, nb: seance.retours.length });
}
