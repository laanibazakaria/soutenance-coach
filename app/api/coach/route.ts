import { NextResponse } from "next/server";
import { appelerGemini } from "@/lib/gemini";
import { computeReport } from "@/lib/scoring";
import { construirePromptCoach, parseAvisCoach, type DemandeCoach } from "@/lib/coach";

/**
 * L'avis du coach sur une session. Le modèle reçoit la transcription, le
 * texte des diapositives et les mesures déjà calculées ; il ne produit que
 * du qualitatif — jamais de note (garde-fou du projet).
 */

function estDemande(v: unknown): v is DemandeCoach {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.transcript !== "string" || o.transcript.trim() === "") return false;
  if (typeof o.durationMs !== "number" || o.durationMs <= 0) return false;
  if (o.targetDurationMs !== undefined && typeof o.targetDurationMs !== "number") return false;
  if (o.slides !== undefined && !Array.isArray(o.slides)) return false;
  if (o.slidesTiming !== undefined && !Array.isArray(o.slidesTiming)) return false;
  if (o.candidature !== undefined && (typeof o.candidature !== "object" || o.candidature === null)) return false;
  return true;
}

export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (!estDemande(corps)) {
    return NextResponse.json({ erreur: "Transcription ou durée manquante." }, { status: 400 });
  }

  const rapport = computeReport({
    transcript: corps.transcript,
    durationMs: corps.durationMs,
    targetDurationMs: corps.targetDurationMs,
  });

  const resultat = await appelerGemini(construirePromptCoach(corps, rapport), {
    maxOutputTokens: 3500,
    temperature: 0.4,
  });
  if (!resultat.ok) {
    return NextResponse.json(
      { erreur: `${resultat.erreur} Les mesures automatiques restent disponibles.`, code: resultat.code },
      { status: resultat.code === "cle_absente" ? 503 : 502 },
    );
  }

  const avis = parseAvisCoach(resultat.texte);
  if (!avis) {
    return NextResponse.json(
      { erreur: "L'avis renvoyé était inexploitable. Les mesures automatiques restent valables.", code: "format" },
      { status: 502 },
    );
  }
  return NextResponse.json({ avis });
}
