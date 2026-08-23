"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSessions } from "@/lib/storage";
import { buildTrendReport, SEUILS_TENDANCES } from "@/lib/trends";
import type { SessionRecord } from "@/lib/types";
import TrendsView from "@/app/components/TrendsView";
import ParcoursView from "../components/ParcoursView";
import RapportView from "../components/RapportView";
import { pousserTout, surSynchronisation } from "@/lib/sync/client";

/** Le module Soutenance : le parcours, puis la progression mesurée. */
export default function SoutenancePage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);

  useEffect(() => {
    const lire = () => setSessions(listSessions(window.localStorage).filter((s) => !s.mode || s.mode === "soutenance"));
    lire();
    return surSynchronisation(lire);
  }, []);

  if (sessions === null) return null;

  const trends = sessions.length > 0 ? buildTrendReport(sessions) : null;
  const anyTrendUnlocked = trends?.some((t) => t.trend !== "absent") ?? false;
  const remaining = Math.max(0, SEUILS_TENDANCES.minSessions - sessions.length);

  return (
    <>
      <ParcoursView sessions={sessions} onChange={() => void pousserTout()} />
      <RapportView />

      <div className="list-head">
        <h2 className="list-title">Tes sessions de soutenance</h2>
        <div className="list-actions">
          <Link href="/app/sessions" className="btn small">
            Historique
          </Link>
          <Link href="/app/session" className="btn small primary">
            🎤 Nouvelle session
          </Link>
        </div>
      </div>
      {anyTrendUnlocked && trends ? (
        <TrendsView trends={trends} />
      ) : (
        <div className="card teaser">
          {sessions.length === 0 ? (
            <>
              Aucune session encore. <Link href="/app/session">Lance ta première</Link> — deux minutes suffisent.
            </>
          ) : (
            <>
              🔒 Encore {remaining} session{remaining > 1 ? "s" : ""} pour débloquer tes tendances — le coach ne juge pas ta progression sur du bruit.
            </>
          )}
        </div>
      )}
    </>
  );
}
