import { NextResponse } from "next/server";

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
      const r = await fetch(e.url, { method: "POST", headers: { authorization: `Bearer ${e.cle}` }, body: fd, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { text?: string };
      const texte = (j.text ?? "").trim();
      // Whisper hallucine des remerciements sur le silence : on les ignore.
      const bruit = /^(merci|thank you|thanks|sous-titrage|amara\.org|\.|\s)*$/i;
      return NextResponse.json({ texte: bruit.test(texte) ? "" : texte, fournisseur: e.nom });
    } catch {
      /* fournisseur suivant */
    }
  }
  return NextResponse.json({ erreur: "Transcription indisponible." }, { status: 502 });
}
