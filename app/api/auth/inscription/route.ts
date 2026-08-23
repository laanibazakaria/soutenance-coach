import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, baseConfiguree } from "@/lib/prisma";

/**
 * Création de compte par e-mail + mot de passe. Le mot de passe n'est jamais
 * stocké : seulement son empreinte bcrypt. Si l'adresse existe déjà via
 * Google, on le dit — pas de fusion silencieuse de comptes.
 */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Les comptes ne sont pas disponibles sur ce déploiement." }, { status: 503 });
  let corps: { nom?: unknown; email?: unknown; mdp?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const nom = typeof corps.nom === "string" ? corps.nom.trim().slice(0, 80) : "";
  const email = typeof corps.email === "string" ? corps.email.trim().toLowerCase() : "";
  const mdp = typeof corps.mdp === "string" ? corps.mdp : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ erreur: "Adresse e-mail invalide." }, { status: 400 });
  if (mdp.length < 8) return NextResponse.json({ erreur: "Mot de passe trop court : 8 caractères minimum." }, { status: 400 });
  if (nom.length < 2) return NextResponse.json({ erreur: "Dis-nous ton prénom (ou un pseudo)." }, { status: 400 });

  const existant = await prisma.user.findUnique({ where: { email }, select: { id: true, motDePasse: true } });
  if (existant?.motDePasse) return NextResponse.json({ erreur: "Un compte existe déjà avec cette adresse. Connecte-toi." }, { status: 409 });
  if (existant) return NextResponse.json({ erreur: "Cette adresse est déjà liée à un compte Google. Connecte-toi avec Google." }, { status: 409 });

  const empreinte = await bcrypt.hash(mdp, 12);
  await prisma.user.create({ data: { email, name: nom, motDePasse: empreinte } });
  return NextResponse.json({ ok: true });
}
