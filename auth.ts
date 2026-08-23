import NextAuth, { type DefaultSession } from "next-auth";
import { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { emailConfigure, expediteur, envoyerLienConnexion } from "@/lib/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Authentification — optionnelle par conception.
 *
 * Sans compte, l'application reste entièrement locale. Avec un compte, les
 * sessions, le support et les résultats IA suivent l'utilisateur sur tous
 * ses appareils. Fournisseurs : Google (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) et
 * lien magique par e-mail (RESEND_API_KEY, EMAIL_FROM une fois le domaine vérifié).
 */

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/** Levée quand le compte existe mais que l'adresse n'a pas été vérifiée. */
class EmailNonVerifie extends CredentialsSignin {
  code = "email_non_verifie";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(authConfiguree() ? [Google] : []),
    ...(process.env.DATABASE_URL
      ? [
          Credentials({
            credentials: { email: {}, mdp: {} },
            async authorize(identifiants) {
              const email = typeof identifiants?.email === "string" ? identifiants.email.trim().toLowerCase() : "";
              const mdp = typeof identifiants?.mdp === "string" ? identifiants.mdp : "";
              if (!email || !mdp) return null;
              const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, image: true, motDePasse: true, emailVerified: true } });
              if (!u?.motDePasse) return null;
              const bon = await bcrypt.compare(mdp, u.motDePasse);
              if (!bon) return null;
              // Pas d'entrée sans adresse vérifiée — exactement comme Propulsez.
              if (!u.emailVerified) throw new EmailNonVerifie();
              return { id: u.id, name: u.name, email: u.email, image: u.image };
            },
          }),
        ]
      : []),
    ...(emailConfigure() && process.env.DATABASE_URL
      ? [
          Resend({
            apiKey: process.env.RESEND_API_KEY,
            from: expediteur(),
            // Un e-mail en français, à notre charte — pas le gabarit anglais par défaut.
            sendVerificationRequest: ({ identifier, url }) => envoyerLienConnexion(identifier, url),
          }),
        ]
      : []),
  ],
  // JWT : pas de lecture en base à chaque requête — les données utilisateur,
  // elles, sont bien persistées par l'adaptateur.
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: "/app/connexion", error: "/app/connexion", verifyRequest: "/app/connexion?envoye=1" },
  trustHost: true,
});

/** Vrai si la connexion Google est configurée sur ce déploiement. */
export function authConfiguree(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.DATABASE_URL);
}
