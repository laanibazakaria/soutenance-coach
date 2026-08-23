import "server-only";
import { prisma } from "@/lib/prisma";
import { envoyerCodeVerification } from "@/lib/email";
import { genererCode, empreinteCode, expirationCode, PREFIXE_CODE, codePlausible } from "@/lib/verification";

/** Génère, range et envoie un code pour cette adresse (un seul code actif à la fois). */
export async function envoyerNouveauCode(email: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const code = genererCode();
  await prisma.verificationToken.deleteMany({ where: { identifier: email, token: { startsWith: PREFIXE_CODE } } });
  await prisma.verificationToken.create({ data: { identifier: email, token: empreinteCode(email, code), expires: expirationCode() } });
  const r = await envoyerCodeVerification(email, code);
  if (!r.ok) {
    return {
      ok: false,
      erreur: r.erreur.includes("testing emails") || r.erreur.includes("verify a domain")
        ? "L'inscription par e-mail ouvre très bientôt. En attendant, entre avec Google — c'est immédiat."
        : "Le code n'a pas pu être envoyé. Réessaie, ou utilise Google.",
    };
  }
  return { ok: true };
}

/** Vérifie le code : consomme le jeton et marque l'adresse vérifiée. */
export async function verifierCode(email: string, code: unknown): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (!codePlausible(code)) return { ok: false, erreur: "Le code fait 6 chiffres." };
  const jeton = await prisma.verificationToken.findUnique({ where: { identifier_token: { identifier: email, token: empreinteCode(email, code.trim()) } } }).catch(() => null);
  if (!jeton) return { ok: false, erreur: "Code incorrect. Vérifie l'e-mail, ou renvoie un code." };
  await prisma.verificationToken.delete({ where: { identifier_token: { identifier: jeton.identifier, token: jeton.token } } }).catch(() => {});
  if (jeton.expires < new Date()) return { ok: false, erreur: "Ce code a expiré. Renvoie un code." };
  await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });
  return { ok: true };
}
