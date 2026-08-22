import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Authentification — optionnelle par conception.
 *
 * Sans compte, l'application reste entièrement locale. Avec un compte, les
 * sessions, le support et les résultats IA suivent l'utilisateur sur tous
 * ses appareils. Fournisseur : Google (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).
 */

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: authConfiguree() ? [Google] : [],
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
