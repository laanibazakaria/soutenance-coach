import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";

/** Liste d'attente de l'offre Pro : un e-mail, rien d'autre. */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible sur ce déploiement." }, { status: 503 });
  let email = "";
  try {
    email = String(((await request.json()) as { email?: unknown }).email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    return NextResponse.json({ erreur: "Adresse e-mail invalide." }, { status: 400 });
  }
  await prisma.interet.upsert({ where: { email }, create: { email }, update: {} });
  return NextResponse.json({ ok: true });
}
