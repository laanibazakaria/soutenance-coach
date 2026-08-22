import type { NextConfig } from "next";

/**
 * Déploiement unique : Vercel. L'application a des routes serveur (comptes,
 * synchronisation, IA) — un export statique n'est plus possible, et une copie
 * statique partielle induirait les utilisateurs en erreur.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
