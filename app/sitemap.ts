import type { MetadataRoute } from "next";

/**
 * Les pages qui méritent d'être trouvées : la vitrine d'abord, puis les pages
 * légales. Le reste vit derrière le mur de compte et n'a rien à faire dans un
 * index de recherche.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://soutenance-coach.vercel.app";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/app`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
