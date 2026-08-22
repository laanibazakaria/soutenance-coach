import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";

/** Suppression d'une session du compte — seulement la sienne. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const { id } = await context.params;
  const { count } = await prisma.trainingSession.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true, supprimees: count });
}
