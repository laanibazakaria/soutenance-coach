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

/**
 * Modèle configurable : Google retire régulièrement les versions anciennes
 * (gemini-2.0-flash a disparu en cours de développement). La variable permet
 * d'en changer sans redéployer le code.
 */
const MODELE = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
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
          // Les modèles Gemini 3.x consomment une partie du budget en
          // raisonnement avant de rédiger : un budget serré renvoie une
          // réponse vide ou tronquée (constaté en test). L'avis lui-même
          // reste court, c'est la marge de réflexion qui doit être large.
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      }),
      // Une soutenance n'attend pas : au-delà, on rend la main.
      signal: AbortSignal.timeout(20_000),
    });

    if (!reponseApi.ok) {
      const statut = reponseApi.status;
      const messages: Record<number, string> = {
        429: "Le quota gratuit du modèle est atteint pour le moment. Réessaie dans quelques minutes — les mesures automatiques, elles, restent disponibles.",
        503: "Le modèle est très demandé en ce moment. Réessaie dans un instant — les mesures automatiques restent disponibles.",
        404: "Le modèle configuré n'existe plus. Mets à jour la variable GEMINI_MODEL — les mesures automatiques restent disponibles.",
        401: "La clé du modèle est refusée. Vérifie GEMINI_API_KEY — les mesures automatiques restent disponibles.",
      };
      const codes: Record<number, string> = {
        429: "quota",
        503: "surcharge",
        404: "modele",
        401: "cle_invalide",
      };
      return NextResponse.json(
        {
          erreur:
            messages[statut] ??
            "Le service d'évaluation n'a pas répondu correctement. Les mesures automatiques restent disponibles.",
          code: codes[statut] ?? "amont",
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
