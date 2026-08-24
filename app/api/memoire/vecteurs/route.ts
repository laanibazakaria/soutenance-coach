import { NextResponse } from "next/server";
import { verifierQuota } from "@/lib/quota-serveur";

/**
 * Les vecteurs des passages du mémoire — chez Mistral (Europe, et
 * l'entraînement sur nos requêtes est désactivé côté console) : un mémoire de
 * stage est souvent confidentiel, il n'a rien à faire dans un palier gratuit
 * qui s'autorise à s'entraîner dessus.
 *
 * Le texte transite, il n'est jamais conservé ici : les vecteurs repartent
 * vers l'appareil, qui fait la recherche lui-même.
 */
const MODELE = process.env.MISTRAL_EMBED_MODEL ?? "mistral-embed";
const LOTS = 32;
const TEXTES_MAX = 130;
const CHARS_MAX = 2400;

export async function POST(request: Request) {
  const cle = process.env.MISTRAL_API_KEY;
  if (!cle) return NextResponse.json({ erreur: "La lecture du mémoire n'est pas configurée sur ce déploiement." }, { status: 503 });

  let corps: { textes?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const textes = Array.isArray(corps.textes) ? corps.textes.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.slice(0, CHARS_MAX)) : [];
  if (textes.length === 0) return NextResponse.json({ erreur: "Rien à vectoriser." }, { status: 400 });
  if (textes.length > TEXTES_MAX) return NextResponse.json({ erreur: "Trop de passages d'un coup." }, { status: 413 });

  // Un seul passage (une question pendant l'appel) ne consomme pas de quota :
  // sinon un oral de dix questions coûterait dix appels IA à l'étudiant.
  const quota = textes.length > 1 ? await verifierQuota(request) : null;
  if (quota && !quota.ok) return quota.reponse;

  const vecteurs: number[][] = [];
  for (let i = 0; i < textes.length; i += LOTS) {
    const lot = textes.slice(i, i + LOTS);
    try {
      const r = await fetch("https://api.mistral.ai/v1/embeddings", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
        body: JSON.stringify({ model: MODELE, input: lot }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) {
        const detail = (await r.text()).slice(0, 200);
        return NextResponse.json({ erreur: r.status === 429 ? "Trop de demandes d'un coup. Réessaie dans une minute." : "La lecture du mémoire a échoué.", detail }, { status: r.status === 429 ? 429 : 502 });
      }
      const j = (await r.json()) as { data?: Array<{ embedding: number[] }> };
      for (const d of j.data ?? []) vecteurs.push(d.embedding);
    } catch {
      return NextResponse.json({ erreur: "Le service de lecture est injoignable." }, { status: 504 });
    }
  }
  if (vecteurs.length !== textes.length) return NextResponse.json({ erreur: "Lecture incomplète du mémoire." }, { status: 502 });
  if (quota?.ok) await quota.confirmer();
  return NextResponse.json({ vecteurs, dimensions: vecteurs[0]?.length ?? 0 });
}
