import { NextResponse } from "next/server";
import { analyserReponse, construirePrompt, parseAvis } from "@/lib/jury/evaluation";
import type { JuryQuestion } from "@/lib/slides/types";

/**
 * Évaluation d'une réponse orale par un modèle de langage.
 *
 * La clé reste ici, côté serveur — elle n'est jamais exposée au navigateur.
 * Le modèle ne reçoit que la question, la réponse transcrite et les mesures
 * déjà calculées ; il ne produit que du qualitatif (garde-fou du projet).
 */

const MODELE = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent`;

interface CorpsRequete {
  question?: JuryQuestion;
  reponse?: string;
  latenceMs?: number;
  contexteSlides?: string;
}

export async function POST(request: Request) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) {
    return NextResponse.json(
      {
        erreur:
          "L'évaluation par IA n'est pas configurée sur ce déploiement. Les mesures automatiques restent disponibles.",
        code: "cle_absente",
      },
      { status: 503 },
    );
  }

  let corps: CorpsRequete;
  try {
    corps = (await request.json()) as CorpsRequete;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const { question, reponse, latenceMs, contexteSlides } = corps;
  if (!question?.question || typeof reponse !== "string") {
    return NextResponse.json({ erreur: "Question ou réponse manquante." }, { status: 400 });
  }

  const analyse = analyserReponse(reponse, latenceMs);
  const prompt = construirePrompt({ question, reponse, contexteSlides }, analyse);

  try {
    const reponseApi = await fetch(`${ENDPOINT}?key=${encodeURIComponent(cle)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
        },
      }),
      // Une soutenance n'attend pas : au-delà, on rend la main.
      signal: AbortSignal.timeout(20_000),
    });

    if (!reponseApi.ok) {
      const statut = reponseApi.status;
      return NextResponse.json(
        {
          erreur:
            statut === 429
              ? "Le quota gratuit du modèle est atteint pour le moment. Réessaie dans quelques minutes — les mesures automatiques, elles, restent disponibles."
              : "Le service d'évaluation n'a pas répondu correctement. Les mesures automatiques restent disponibles.",
          code: statut === 429 ? "quota" : "amont",
        },
        { status: 502 },
      );
    }

    const data = (await reponseApi.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texte = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const avis = parseAvis(texte);

    if (!avis) {
      // Le modèle a répondu hors format : on refuse plutôt que de présenter
      // un avis approximatif comme s'il était fiable.
      return NextResponse.json(
        {
          erreur: "L'avis renvoyé était inexploitable. Les mesures automatiques restent valables.",
          code: "format",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ avis, analyse });
  } catch {
    return NextResponse.json(
      {
        erreur:
          "L'évaluation a pris trop de temps ou le service est injoignable. Les mesures automatiques restent disponibles.",
        code: "reseau",
      },
      { status: 504 },
    );
  }
}
