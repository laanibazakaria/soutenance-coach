import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function estAdmin(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return Boolean(email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase());
}

/** Modération des retours d'oral : lister, approuver, supprimer. */
export async function GET() {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Base non configurée." }, { status: 503 });
  if (!(await estAdmin())) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  const retours = await prisma.retourOral.findMany({ orderBy: [{ approuve: "asc" }, { creeLe: "desc" }], take: 200 });
  return NextResponse.json({ retours });
}

export async function PATCH(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Base non configurée." }, { status: 503 });
  if (!(await estAdmin())) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  const { id, approuve } = (await request.json().catch(() => ({}))) as { id?: unknown; approuve?: unknown };
  if (typeof id !== "string" || typeof approuve !== "boolean") return NextResponse.json({ erreur: "id et approuve requis." }, { status: 400 });
  await prisma.retourOral.update({ where: { id }, data: { approuve } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Base non configurée." }, { status: 503 });
  if (!(await estAdmin())) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  const { id } = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (typeof id !== "string") return NextResponse.json({ erreur: "id requis." }, { status: 400 });
  await prisma.retourOral.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
