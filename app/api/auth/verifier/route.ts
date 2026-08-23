import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { verifierCode, envoyerNouveauCode } from "@/lib/verification-serveur";

/** POST : valider le code à 6 chiffres. PUT : renvoyer un code. */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible." }, { status: 503 });
  let corps: { email?: unknown; code?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const email = typeof corps.email === "string" ? corps.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ erreur: "Adresse manquante." }, { status: 400 });
  const r = await verifierCode(email, corps.code);
  if (!r.ok) return NextResponse.json({ erreur: r.erreur }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible." }, { status: 503 });
  let corps: { email?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const email = typeof corps.email === "string" ? corps.email.trim().toLowerCase() : "";
  const u = email ? await prisma.user.findUnique({ where: { email }, select: { emailVerified: true, motDePasse: true } }) : null;
  // Réponse identique que le compte existe ou non : pas d'énumération d'adresses.
  if (!u || u.emailVerified || !u.motDePasse) return NextResponse.json({ ok: true });
  const r = await envoyerNouveauCode(email);
  if (!r.ok) return NextResponse.json({ erreur: r.erreur }, { status: 502 });
  return NextResponse.json({ ok: true });
}
