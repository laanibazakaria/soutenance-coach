import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { empreinteIp, etatQuota, limitePour, messageQuota, moisCourant, type EtatQuota, type TypeQuota } from "@/lib/quota";

/**
 * Quotas côté serveur. Identité : le compte connecté, sinon une empreinte de
 * l'adresse IP (jamais l'adresse). Sans base configurée, on ne compte pas —
 * un déploiement local ne doit pas exiger PostgreSQL.
 */

async function identite(request: Request): Promise<{ cle: string; type: TypeQuota; admin: boolean }> {
  const session = baseConfiguree() ? await auth() : null;
  const email = session?.user?.email ?? null;
  const admin = Boolean(email && process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase());
  if (session?.user?.id) return { cle: `user:${session.user.id}`, type: "compte", admin };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
  return { cle: `ip:${empreinteIp(ip, process.env.AUTH_SECRET ?? "sel")}`, type: "anonyme", admin: false };
}

export async function lireQuota(request: Request): Promise<EtatQuota & { admin: boolean }> {
  const { cle, type, admin } = await identite(request);
  const limite = limitePour(type, process.env);
  if (!baseConfiguree()) return { ...etatQuota(type, 0, limite), admin };
  const ligne = await prisma.usage.findUnique({ where: { cle_mois: { cle, mois: moisCourant() } } });
  return { ...etatQuota(type, ligne?.appels ?? 0, limite), admin };
}

/**
 * Consomme un appel. À appeler juste avant l'appel au modèle, après la
 * validation de la requête — une requête invalide ne coûte rien.
 */
export async function consommerQuota(request: Request): Promise<{ ok: true; etat: EtatQuota } | { ok: false; reponse: NextResponse }> {
  const { cle, type, admin } = await identite(request);
  const limite = limitePour(type, process.env);
  if (!baseConfiguree()) return { ok: true, etat: etatQuota(type, 0, limite) };
  const mois = moisCourant();
  const ligne = await prisma.usage.upsert({
    where: { cle_mois: { cle, mois } },
    create: { cle, mois, appels: 1 },
    update: { appels: { increment: 1 } },
  });
  const etat = etatQuota(type, ligne.appels, limite);
  if (!admin && ligne.appels > limite) {
    return {
      ok: false,
      reponse: NextResponse.json({ erreur: messageQuota(etat), code: "quota", quota: etat }, { status: 429 }),
    };
  }
  return { ok: true, etat };
}
