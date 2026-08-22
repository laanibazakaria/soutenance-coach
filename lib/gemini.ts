/**
 * Client Gemini côté serveur — la clé ne quitte jamais ce fichier.
 *
 * Toutes les routes IA passent par ici : même modèle, mêmes délais, mêmes
 * messages d'erreur. Le modèle se change par variable d'environnement, car
 * Google retire régulièrement les anciennes versions.
 */

import "server-only";

const MODELE = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent`;

export type ResultatGemini =
  | { ok: true; texte: string }
  | { ok: false; status: number; code: string; erreur: string };

const MESSAGES: Record<number, [code: string, message: string]> = {
  429: ["quota", "Le quota gratuit du modèle est atteint pour le moment. Réessaie dans quelques minutes."],
  503: ["surcharge", "Le modèle est très demandé en ce moment. Réessaie dans un instant."],
  404: ["modele", "Le modèle configuré n'existe plus. Mets à jour la variable GEMINI_MODEL."],
  401: ["cle_invalide", "La clé du modèle est refusée. Vérifie GEMINI_API_KEY."],
  403: ["cle_invalide", "La clé du modèle est refusée. Vérifie GEMINI_API_KEY."],
};

export function cleConfiguree(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Appelle le modèle en mode JSON. Le budget de tokens doit rester large : les
 * modèles Gemini 3.x consomment une part en raisonnement avant de rédiger.
 */
export async function appelerGemini(
  prompt: string,
  options: { maxOutputTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<ResultatGemini> {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) {
    return {
      ok: false,
      status: 503,
      code: "cle_absente",
      erreur: "L'IA n'est pas configurée sur ce déploiement.",
    };
  }

  // Le palier gratuit renvoie régulièrement 503 « high demand » de façon
  // transitoire (constaté en test). On réessaie deux fois avec une pause
  // croissante avant de remonter l'erreur à l'utilisateur.
  const pauses = [2_000, 5_000];
  let resultat = await tenter(prompt, cle, options);
  for (const pause of pauses) {
    if (resultat.ok || resultat.status !== 503) break;
    await new Promise((r) => setTimeout(r, pause));
    resultat = await tenter(prompt, cle, options);
  }
  return resultat;
}

async function tenter(
  prompt: string,
  cle: string,
  options: { maxOutputTokens?: number; temperature?: number; timeoutMs?: number },
): Promise<ResultatGemini> {
  try {
    const reponse = await fetch(`${ENDPOINT}?key=${encodeURIComponent(cle)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.5,
          maxOutputTokens: options.maxOutputTokens ?? 4000,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    });

    if (!reponse.ok) {
      const [code, message] = MESSAGES[reponse.status] ?? [
        "amont",
        "Le service IA n'a pas répondu correctement.",
      ];
      return { ok: false, status: reponse.status, code, erreur: message };
    }

    const data = (await reponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    const candidat = data.candidates?.[0];
    const texte = candidat?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (texte.trim() === "") {
      return {
        ok: false,
        status: 502,
        code: candidat?.finishReason === "MAX_TOKENS" ? "tronque" : "vide",
        erreur: "Le modèle a renvoyé une réponse vide. Réessaie.",
      };
    }
    return { ok: true, texte };
  } catch {
    return {
      ok: false,
      status: 504,
      code: "reseau",
      erreur: "L'IA a pris trop de temps ou est injoignable. Réessaie.",
    };
  }
}
