import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fournisseursDisponibles, testerFournisseur } from "@/lib/llm";

/**
 * L'état réel des fournisseurs IA : lequel répond, en combien de temps, et
 * lequel refuse. Réservé à l'administrateur — c'est ce qui permet de savoir
 * quelle clé a expiré sans attendre qu'un étudiant tombe dessus.
 */
async function estAdmin(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return Boolean(email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase());
}

export async function GET() {
  if (!(await estAdmin())) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  const noms = fournisseursDisponibles("qualite");
  const etats = await Promise.all(noms.map((nom) => testerFournisseur(nom)));
  return NextResponse.json({ configures: noms.length, etats });
}
