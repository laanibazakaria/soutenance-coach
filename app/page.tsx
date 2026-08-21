"use client";

import { useEffect, useState } from "react";
import { listSessions, removeSession } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import { buildTrendReport, SEUILS_TENDANCES } from "@/lib/trends";
import type { SessionRecord } from "@/lib/types";
import TrendsView from "@/app/components/TrendsView";

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

/** Unités courtes pour les chips de l'historique. */
const CHIP_UNITS: Record<string, string> = {
  debit: "mots/min",
  bequilles: "béq./100 mots",
  phrases: "mots/phrase",
};

/** Chips par session : les valeurs mesurables du rapport, recalculées à la volée. */
function SessionChips({ session }: { session: SessionRecord }) {
  const report = computeReport({ transcript: session.transcript, durationMs: session.durationMs });
  const chips = report.metrics
    .filter((m) => m.level !== "absent" && m.value !== undefined)
    .map((m) => ({ id: m.id, level: m.level, text: `${m.value} ${CHIP_UNITS[m.id] ?? ""}`.trim() }));
  if (chips.length === 0) return null;
  return (
    <div className="chips">
      {chips.map((c) => (
        <span key={c.id} className={`chip chip-${c.level}`}>
          {c.text}
        </span>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);

  useEffect(() => {
    setSessions(listSessions(window.localStorage));
  }, []);

  function handleRemove(id: string) {
    setSessions(removeSession(window.localStorage, id));
  }

  const trends = sessions !== null && sessions.length > 0 ? buildTrendReport(sessions) : null;
  const anyTrendUnlocked = trends?.some((t) => t.trend !== "absent") ?? false;
  const remaining =
    sessions === null ? 0 : Math.max(0, SEUILS_TENDANCES.minSessions - sessions.length);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Tes sessions</h1>
          <p className="subtitle">Enregistre-toi, relis-toi, progresse.</p>
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
        <>
          {anyTrendUnlocked && trends ? (
            <TrendsView trends={trends} />
          ) : (
            <div className="card teaser">
              🔒 Encore {remaining} session{remaining > 1 ? "s" : ""} pour débloquer tes tendances
              — le coach ne juge pas ta progression sur du bruit.
            </div>
          )}

          <h2 className="list-title">Historique</h2>
          {sessions.map((s) => (
            <div key={s.id} className="card session-row">
              <div>
                <div className="session-meta">
                  {formatDate(s.startedAt)} · {formatDuration(s.durationMs)} · {s.wordCount} mots
                </div>
                <SessionChips session={s} />
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
          ))}
        </>
      )}
    </>
  );
}
