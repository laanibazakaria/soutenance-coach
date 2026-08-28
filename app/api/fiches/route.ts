import { NextResponse } from "next/server";
import { appelerIA } from "@/lib/llm";
import { verifierQuota } from "@/lib/quota-serveur";
import { construirePromptFiches, parseFiches } from "@/lib/fiches";

/** Vercel tue la route à ce plafond : mieux vaut le choisir que le subir. */
export const maxDuration = 90;

/**
 * Génération des fiches à mémoriser depuis le texte des diapositives. Le
 * modèle a interdiction d'inventer un chiffre absent du support ; la
 * révision espacée, elle, est calculée côté navigateur par du code testé.
 */

interface CorpsRequete {
  slides?: unknown;
}

export async function POST(request: Request) {
  let corps: CorpsRequete;
  try {
    corps = (await request.json()) as CorpsRequete;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const slides = Array.isArray(corps.slides)
    ? corps.slides.filter(
        (s): s is { numero: number; titre: string; texte: string } =>
          typeof s === "object" && s !== null &&
          typeof (s as { numero?: unknown }).numero === "number" &&
          typeof (s as { titre?: unknown }).titre === "string" &&
          typeof (s as { texte?: unknown }).texte === "string",
      )
    : [];
  if (slides.length === 0) {
    return NextResponse.json({ erreur: "Aucune diapositive fournie." }, { status: 400 });
  }

  // Quota vérifié avant le modèle, consommé seulement après succès : ni une requête invalide ni une panne du fournisseur ne coûtent un appel.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  const resultat = await appelerIA(construirePromptFiches(slides), { maxOutputTokens: 4000, temperature: 0.5 });
  if (resultat.ok) await quota.confirmer();
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  }

  const fiches = parseFiches(resultat.texte, slides.length);
  if (!fiches) {
    return NextResponse.json({ erreur: "Les fiches renvoyées étaient inexploitables. Réessaie dans un instant.", code: "format" }, { status: 502 });
  }
  return NextResponse.json({ fiches });
}
