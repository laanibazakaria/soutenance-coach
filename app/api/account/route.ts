import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";

/**
 * Suppression du compte : immédiate et définitive. Les relations sont en
 * cascade (sessions, support, parcours, résultats IA, comptes Google). On
 * ne garde rien — pas de « désactivation » douce qui conserverait les
 * données sans le dire.
 */
export async function DELETE() {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Comptes non configurés." }, { status: 503 });
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    // Déjà supprimé (double clic, second appareil) : l'objectif est atteint.
  }
  return NextResponse.json({ ok: true });
}
