import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(authConfiguree() ? [Google] : []),
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
  pages: { signIn: "/app/connexion" },
  trustHost: true,
});

/** Vrai si la connexion Google est configurée sur ce déploiement. */
export function authConfiguree(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.DATABASE_URL);
}
