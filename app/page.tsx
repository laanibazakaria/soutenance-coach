"use client";

import { useEffect, useState } from "react";
import { listSessions, removeSession } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min} min ${sec.toString().padStart(2, "0")} s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);

  useEffect(() => {
    setSessions(listSessions(window.localStorage));
  }, []);

  function handleRemove(id: string) {
    setSessions(removeSession(window.localStorage, id));
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Tes sessions</h1>
          <p className="subtitle">
            Enregistre-toi, relis-toi, progresse. Semaine 1 : capture et transcription.
          </p>
        </div>
        <a href="/session" className="btn primary">
          🎤 Nouvelle session
        </a>
      </div>

      {sessions === null ? null : sessions.length === 0 ? (
        <div className="empty">
          <p>Aucune session pour l&apos;instant.</p>
          <p>Lance ta première session d&apos;entraînement — il ne faut qu&apos;un micro.</p>
        </div>
      ) : (
        sessions.map((s) => (
          <div key={s.id} className="card session-row">
            <div>
              <div className="session-meta">
                {formatDate(s.startedAt)} · {formatDuration(s.durationMs)} · {s.wordCount} mots
              </div>
              <div className="session-excerpt">{s.transcript || "(transcription vide)"}</div>
            </div>
            <button
              className="btn danger"
              onClick={() => handleRemove(s.id)}
              aria-label={`Supprimer la session du ${formatDate(s.startedAt)}`}
            >
              Supprimer
            </button>
          </div>
        ))
      )}
    </>
  );
}
