"use client";

import { useEffect, useState } from "react";
import { lireAudio } from "@/lib/audio/stockage";
import { constatsAudio, type MesuresAudio } from "@/lib/audio/mesures";
import { Icone } from "@/app/components/Icone";

/** Réécoute-toi : l'audio de la session, s'il est sur cet appareil, et ce que le son dit. */
export default function LecteurAudio({ sessionId, mesures, compact = false }: { sessionId: string; mesures?: MesuresAudio; compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [absent, setAbsent] = useState(false);

  useEffect(() => {
    let objet: string | null = null;
    void lireAudio(sessionId).then((blob) => {
      if (blob) {
        objet = URL.createObjectURL(blob);
        setUrl(objet);
      } else setAbsent(true);
    });
    return () => {
      if (objet) URL.revokeObjectURL(objet);
    };
  }, [sessionId]);

  const constats = mesures ? constatsAudio(mesures) : [];
  if (absent && constats.length === 0) return null;

  return (
    <div className={`lecteur${compact ? " lecteur-compact" : ""}`}>
      {url && (
        <div className="lecteur-ligne">
          <span className="lecteur-label"><Icone nom="casque" /> Réécoute-toi</span>
          <audio controls preload="metadata" src={url} className="lecteur-audio" />
          {!compact && <span className="session-meta">L&apos;audio est sur cet appareil seulement — jamais envoyé, jamais synchronisé.</span>}
        </div>
      )}
      {constats.length > 0 && !compact && (
        <div className="report-grid" style={{ marginTop: 10 }}>
          {constats.map((c) => (
            <article key={c.id} className={`metric metric-${c.niveau}`}>
              <div className="metric-head">
                <span className="metric-label">{c.id === "pauses" ? "Silences" : "Dynamique de la voix"}</span>
                <span className={`badge badge-${c.niveau}`}>{c.niveau === "bon" ? "Bon" : "À surveiller"}</span>
              </div>
              <p className="metric-summary">{c.message}</p>
            </article>
          ))}
        </div>
      )}
      {constats.length > 0 && compact && (
        <div className="chips" style={{ marginTop: 6 }}>
          {constats.map((c) => (
            <span key={c.id} className={`chip chip-${c.niveau}`}>
              {c.id === "pauses" ? `${mesures!.pausesLongues} blanc${mesures!.pausesLongues > 1 ? "s" : ""} > 1,5 s` : c.niveau === "bon" ? "voix vivante" : "voix monotone"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
