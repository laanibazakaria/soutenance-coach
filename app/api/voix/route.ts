import { NextResponse } from "next/server";

/**
 * La voix naturelle du jury : Gemini TTS (gratuit) transforme une réplique en
 * audio WAV. Utilisée seulement quand le navigateur n'a pas de bonne voix ; en
 * cas d'échec, le client retombe sur la voix du navigateur. Le texte envoyé
 * est la réplique du jury — jamais la parole de l'étudiant.
 */
const MODELE = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const VOIX = { jury: "Charon", recruteur: "Kore" } as const;
const cache = new Map<string, Buffer>();

function wav(pcm: Buffer, rate = 24_000): Buffer {
  const en = Buffer.alloc(44);
  en.write("RIFF", 0);
  en.writeUInt32LE(36 + pcm.length, 4);
  en.write("WAVE", 8);
  en.write("fmt ", 12);
  en.writeUInt32LE(16, 16);
  en.writeUInt16LE(1, 20);
  en.writeUInt16LE(1, 22);
  en.writeUInt32LE(rate, 24);
  en.writeUInt32LE(rate * 2, 28);
  en.writeUInt16LE(2, 32);
  en.writeUInt16LE(16, 34);
  en.write("data", 36);
  en.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([en, pcm]);
}

export async function POST(request: Request) {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) return NextResponse.json({ erreur: "Voix indisponible." }, { status: 503 });
  let corps: { texte?: unknown; langue?: unknown; voix?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const texte = typeof corps.texte === "string" ? corps.texte.trim().slice(0, 600) : "";
  if (texte.length < 2) return NextResponse.json({ erreur: "Texte manquant." }, { status: 400 });
  const langue = corps.langue === "en" ? "en" : "fr";
  const voix = corps.voix === "recruteur" ? VOIX.recruteur : VOIX.jury;
  const cleCache = `${voix}|${langue}|${texte}`;
  const enCache = cache.get(cleCache);
  if (enCache) return new NextResponse(new Uint8Array(enCache), { headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600", "x-voix-cache": "1" } });

  const consigne = langue === "en" ? "Say this calmly, like a precise and attentive interviewer: " : "Dis ceci calmement, comme un membre de jury précis et attentif : ";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent?key=${encodeURIComponent(cle)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: consigne + texte }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voix } } } },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return NextResponse.json({ erreur: "Voix indisponible.", status: r.status }, { status: 502 });
    const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!part?.data) return NextResponse.json({ erreur: "Voix vide." }, { status: 502 });
    const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24_000);
    const audio = wav(Buffer.from(part.data, "base64"), rate);
    if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    cache.set(cleCache, audio);
    return new NextResponse(new Uint8Array(audio), { headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ erreur: "Voix indisponible." }, { status: 504 });
  }
}
