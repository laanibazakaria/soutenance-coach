import type { NextConfig } from "next";

/**
 * Deux cibles de déploiement :
 *
 * - **Vercel** (par défaut) : build complet, avec les routes API — nécessaire
 *   pour le jury qui évalue les réponses, la clé du modèle restant côté serveur.
 * - **GitHub Pages** (`PAGES_BASE_PATH` défini) : export statique. Tout le
 *   produit fonctionne, sauf l'évaluation des réponses, qui exige un serveur.
 *   L'interface le dit explicitement plutôt que d'échouer silencieusement.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";
const exportStatique = basePath !== "";

const nextConfig: NextConfig = {
  ...(exportStatique ? { output: "export" as const, basePath, trailingSlash: true } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
