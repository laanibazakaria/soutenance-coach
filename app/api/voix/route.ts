import { NextResponse } from "next/server";
import { verifierQuota } from "@/lib/quota-serveur";

/**
 * La voix naturelle du jury : Gemini TTS en STREAMING — le premier morceau
 * d'audio part vers le navigateur en ~1,7 s au lieu d'attendre le fichier
 * complet (4 à 9 s). Réponse : PCM 16 bits mono brut, précédé d'un octet
 * d'en-tête maison (fréquence), mis en cache complet par réplique. Le texte
 * envoyé est la réplique du jury — jamais la parole de l'étudiant.
 */
const MODELE = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
/** Quatre timbres nettement différents, un par membre du jury. */
const VOIX = { grave: "Charon", claire: "Kore", vive: "Puck", posee: "Enceladus", jury: "Charon", recruteur: "Kore" } as const;
/** Le seau du flux TTS vu à sec (429) : on l'évite dix minutes. */
let fluxMortJusqua = 0;

const cache = new Map<string, { pcm: Buffer; rate: number }>();

export async function POST(request: Request) {
  // Une clé dédiée à la voix si elle existe : les quotas Google sont par
  // projet, et séparer la voix du reste évite qu'un jour de tests LLM
  // assèche le jury. À défaut, la clé commune.
  const cle = process.env.GEMINI_TTS_KEY ?? process.env.GEMINI_API_KEY;
  if (!cle) return NextResponse.json({ erreur: "Voix indisponible." }, { status: 503 });
  // Vérifié mais jamais confirmé : la voix n'est pas décomptée — sinon dix
  // répliques videraient la moitié d'un mois — mais elle reste fermée à qui a
  // épuisé son quota, ce qui borne la route au lieu de la laisser ouverte.
  const quota = await verifierQuota(request);
  if (!quota.ok) return quota.reponse;
  let corps: { texte?: unknown; langue?: unknown; voix?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const texte = typeof corps.texte === "string" ? corps.texte.trim().slice(0, 600) : "";
  if (texte.length < 2) return NextResponse.json({ erreur: "Texte manquant." }, { status: 400 });
  const langue = corps.langue === "en" ? "en" : "fr";
  const demande = typeof corps.voix === "string" ? corps.voix : "grave";
  const voix = (VOIX as Record<string, string>)[demande] ?? VOIX.grave;
  const cleCache = `${voix}|${langue}|${texte}`;
  const enCache = cache.get(cleCache);
  if (enCache) {
    return new NextResponse(new Uint8Array(enCache.pcm), {
      headers: { "content-type": "application/octet-stream", "x-voix-rate": String(enCache.rate), "x-voix-cache": "1", "cache-control": "private, max-age=3600" },
    });
  }

  const consigne = langue === "en" ? "Say this calmly, like a precise and attentive interviewer: " : "Dis ceci calmement, comme un membre de jury précis et attentif : ";
  const corpsGemini = JSON.stringify({
    contents: [{ parts: [{ text: consigne + texte }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voix } } } },
  });

  /**
   * Le secours NON-flux. Vérifié clé en main le 29/08/2026, même minute,
   * même clé : streamGenerateContent rendait 429 « quota dépassé » pendant
   * que generateContent rendait 200 — Google compte le flux TTS gratuit
   * dans un seau à part, vite à sec. L'audio arrive alors entier (1 à 3 s
   * pour une réplique de jury) au lieu de couler : parfaitement audible,
   * juste un peu moins immédiat.
   */
  async function viaNonFlux(): Promise<NextResponse | null> {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent?key=${encodeURIComponent(cle ?? "")}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: corpsGemini,
        signal: AbortSignal.timeout(40_000),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
      const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!part?.data) return null;
      const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24_000) || 24_000;
      const pcm = Buffer.from(part.data, "base64");
      if (cache.size > 60) cache.delete(cache.keys().next().value as string);
      cache.set(cleCache, { pcm, rate });
      return new NextResponse(new Uint8Array(pcm), {
        headers: { "content-type": "application/octet-stream", "x-voix-rate": String(rate), "x-voix-flux": "non", "cache-control": "no-store" },
      });
    } catch {
      return null;
    }
  }

  let reponse: Response | null = null;
  // Le seau du flux, une fois à sec, le reste un moment : inutile de brûler
  // une requête du budget minuscule (2-3/min) pour re-vérifier à chaque tour.
  if (Date.now() >= fluxMortJusqua) {
    try {
      reponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cle)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: corpsGemini,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      reponse = null;
    }
    if (reponse?.status === 429) fluxMortJusqua = Date.now() + 10 * 60_000;
  }
  if (!reponse?.ok || !reponse.body) {
    const secours = await viaNonFlux();
    if (secours) return secours;
    if (!reponse) return NextResponse.json({ erreur: "Voix injoignable." }, { status: 504 });
    return NextResponse.json({ erreur: "Voix indisponible.", status: reponse.status }, { status: 502 });
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let rate = 24_000;
  const morceaux: Buffer[] = [];

  const flux = new ReadableStream<Uint8Array>({
    async pull(controleur) {
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) {
          if (morceaux.length > 0) {
            if (cache.size > 60) cache.delete(cache.keys().next().value as string);
            cache.set(cleCache, { pcm: Buffer.concat(morceaux), rate });
          }
          controleur.close();
          return;
        }
        tampon += decodeur.decode(value, { stream: true });
        let i;
        let emis = false;
        while ((i = tampon.indexOf("\n")) >= 0) {
          const ligne = tampon.slice(0, i);
          tampon = tampon.slice(i + 1);
          if (!ligne.startsWith("data: ")) continue;
          try {
            const j = JSON.parse(ligne.slice(6)) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
            const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
            if (part?.data) {
              rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? rate);
              const pcm = Buffer.from(part.data, "base64");
              morceaux.push(pcm);
              controleur.enqueue(new Uint8Array(pcm));
              emis = true;
            }
          } catch {
            /* ligne incomplète ou bruit SSE */
          }
        }
        if (emis) return; // un morceau émis : on rend la main, le client joue pendant qu'on relit
      }
    },
    cancel() {
      void lecteur.cancel();
    },
  });

  return new NextResponse(flux, {
    headers: { "content-type": "application/octet-stream", "x-voix-rate": String(rate), "cache-control": "no-store" },
  });
}
