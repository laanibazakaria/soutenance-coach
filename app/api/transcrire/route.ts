import { NextResponse } from "next/server";
import { nettoyerTranscription } from "@/lib/transcription";

/**
 * Transcription d'un segment audio (3 à 5 s) pour les navigateurs sans
 * reconnaissance vocale (Firefox, Safari, mobiles) : Groq Whisper d'abord
 * (8 h d'audio gratuites par jour), Voxtral (Mistral) en secours. L'audio
 * n'est jamais conservé : il transite, il est transcrit, il disparaît.
 */
const TAILLE_MAX = 3 * 1024 * 1024;

export async function POST(request: Request) {
  let forme: FormData;
  try {
    forme = await request.formData();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const fichier = forme.get("audio");
  const langue = forme.get("langue") === "en" ? "en" : "fr";
  // Le vocabulaire du dossier, soufflé à Whisper comme contexte : les sigles
  // et noms propres (ENSIAS, Propulsez, RAG…) survivent à la transcription.
  const lexique = typeof forme.get("lexique") === "string" ? (forme.get("lexique") as string).slice(0, 500) : "";
  if (!(fichier instanceof Blob) || fichier.size < 200) return NextResponse.json({ texte: "" });
  if (fichier.size > TAILLE_MAX) return NextResponse.json({ erreur: "Segment trop lourd." }, { status: 413 });

  const essais: Array<{ nom: string; url: string; cle: string | undefined; modele: string }> = [
    { nom: "groq", url: "https://api.groq.com/openai/v1/audio/transcriptions", cle: process.env.GROQ_API_KEY, modele: "whisper-large-v3-turbo" },
    { nom: "mistral", url: "https://api.mistral.ai/v1/audio/transcriptions", cle: process.env.MISTRAL_API_KEY, modele: "voxtral-mini-latest" },
  ];
  for (const e of essais) {
    if (!e.cle) continue;
    try {
      const fd = new FormData();
      fd.append("file", fichier, "segment.webm");
      fd.append("model", e.modele);
      fd.append("language", langue);
      if (lexique && e.nom === "groq") fd.append("prompt", `Vocabulaire : ${lexique}.`);
      const r = await fetch(e.url, { method: "POST", headers: { authorization: `Bearer ${e.cle}` }, body: fd, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { text?: string };
      // Whisper hallucine des phrases de fin de vidéo sur le silence — vu en
      // vrai : « Sous-titrage Société Radio-Canada » en boucle dans une
      // réponse. Le nettoyage retire ces phrases où qu'elles soient.
      const texte = nettoyerTranscription((j.text ?? "").trim());
      return NextResponse.json({ texte, fournisseur: e.nom });
    } catch {
      /* fournisseur suivant */
    }
  }
  return NextResponse.json({ erreur: "Transcription indisponible." }, { status: 502 });
}
