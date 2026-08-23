import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { emailConfigure } from "@/lib/email";
import { envoyerNouveauCode } from "@/lib/verification-serveur";

/**
 * Création de compte par e-mail + mot de passe, avec vérification de
 * l'adresse : le compte n'ouvre qu'après le code à 6 chiffres reçu par
 * e-mail. Le mot de passe n'est jamais stocké — seulement son empreinte.
 * Repasser par ici avec la même adresse non vérifiée renvoie un nouveau code.
 */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Les comptes ne sont pas disponibles sur ce déploiement." }, { status: 503 });
  if (!emailConfigure()) return NextResponse.json({ erreur: "La création par e-mail n'est pas encore ouverte : utilise Google." }, { status: 503 });
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

  const existant = await prisma.user.findUnique({ where: { email }, select: { id: true, motDePasse: true, emailVerified: true } });
  if (existant?.emailVerified && existant.motDePasse) return NextResponse.json({ erreur: "Un compte existe déjà avec cette adresse. Connecte-toi." }, { status: 409 });
  if (existant?.emailVerified && !existant.motDePasse) return NextResponse.json({ erreur: "Cette adresse est déjà liée à un compte Google. Connecte-toi avec Google." }, { status: 409 });

  const empreinte = await bcrypt.hash(mdp, 12);
  if (existant) {
    // Inscription jamais terminée : on reprend, nouveau mot de passe, nouveau code.
    await prisma.user.update({ where: { id: existant.id }, data: { name: nom, motDePasse: empreinte } });
  } else {
    await prisma.user.create({ data: { email, name: nom, motDePasse: empreinte } });
  }
  const envoi = await envoyerNouveauCode(email);
  if (!envoi.ok) return NextResponse.json({ erreur: envoi.erreur }, { status: 502 });
  return NextResponse.json({ ok: true, verifier: true });
}
