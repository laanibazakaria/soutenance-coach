import type { MetadataRoute } from "next";

/**
 * Ce que les moteurs peuvent lire. L'application elle-même (/app) est indexable
 * jusqu'au mur de compte — c'est la page publique qui doit sortir sur
 * « préparer soutenance PFE » ; l'API et les partages privés, non.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/p/"] }],
    sitemap: "https://soutenance-coach.vercel.app/sitemap.xml",
  };
}
