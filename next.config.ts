import type { NextConfig } from "next";

/**
 * Export statique : l'application n'a ni route d'API ni rendu serveur — tout
 * le calcul se fait dans le navigateur, par conception (aucune donnée ne sort).
 * Elle se sert donc comme un site statique, hébergeable sur GitHub Pages.
 *
 * `basePath` correspond au nom du dépôt, puisque le site est publié sur
 * laanibazakaria.github.io/soutenance-coach.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  // GitHub Pages sert /chemin/ plutôt que /chemin : les liens internes doivent suivre.
  trailingSlash: true,
};

export default nextConfig;
