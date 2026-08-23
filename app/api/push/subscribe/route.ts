import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";

/** Enregistre (ou retire) un abonnement aux notifications. Lié au compte s'il y en a un. */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible sur ce déploiement." }, { status: 503 });
  let corps: { abonnement?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; fuseau?: string };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const a = corps.abonnement;
  if (!a?.endpoint || !a.keys?.p256dh || !a.keys.auth || !/^https:\/\//.test(a.endpoint)) {
    return NextResponse.json({ erreur: "Abonnement invalide." }, { status: 400 });
  }
  const session = await auth();
  const donnees = { p256dh: a.keys.p256dh, auth: a.keys.auth, userId: session?.user?.id ?? null, fuseau: typeof corps.fuseau === "string" ? corps.fuseau.slice(0, 60) : null };
  await prisma.pushAbonnement.upsert({ where: { endpoint: a.endpoint }, create: { endpoint: a.endpoint, ...donnees }, update: donnees });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ ok: true });
  let endpoint = "";
  try {
    endpoint = String(((await request.json()) as { endpoint?: unknown }).endpoint ?? "");
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (endpoint) await prisma.pushAbonnement.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
