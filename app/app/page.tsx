"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { listSessions, removeSession, exportSessions, importSessions } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import { buildTrendReport, SEUILS_TENDANCES } from "@/lib/trends";
import type { SessionRecord } from "@/lib/types";
import TrendsView from "@/app/components/TrendsView";
import ParcoursView from "./components/ParcoursView";
import AvisCoach from "@/app/components/AvisCoach";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { pousserTout, supprimerDistante, surSynchronisation } from "@/lib/sync/client";

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
  temps: "min",
  debit: "mots/min",
  bequilles: "béq./100 mots",
  phrases: "mots/phrase",
};

/** Chips par session : les valeurs mesurables du rapport, recalculées à la volée. */
function SessionChips({ session }: { session: SessionRecord }) {
  const report = computeReport({
    transcript: session.transcript,
    durationMs: session.durationMs,
    confidence: session.confidence,
    targetDurationMs: session.targetDurationMs,
  });
  const chips = report.metrics
    .filter((m) => m.level !== "absent" && m.value !== undefined)
    .map((m) => ({ id: m.id, level: m.level, text: `${m.value} ${CHIP_UNITS[m.id] ?? ""}`.trim() }));
  const avecSlides = session.slides && session.slides.length > 0;
  if (chips.length === 0 && !avecSlides) return null;
  return (
    <div className="chips">
      {avecSlides && <span className="chip chip-info">🎞️ {session.slides!.length} diapositives</span>}
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const toast = useToast();
  const setNotice = (message: string) => toast.info(message);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessions(listSessions(window.localStorage));
    // Après une synchronisation (connexion sur un nouvel appareil), relire.
    return surSynchronisation(() => setSessions(listSessions(window.localStorage)));
  }, []);

  function handleRemove(id: string) {
    setSessions(removeSession(window.localStorage, id));
    void supprimerDistante(id);
    setConfirmingId(null);
    toast.success("Session supprimée.");
  }

  function handleExport() {
    if (!sessions || sessions.length === 0) return;
    const json = exportSessions(sessions, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `soutenance-coach-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`${sessions.length} session${sessions.length > 1 ? "s" : ""} exportée${sessions.length > 1 ? "s" : ""}.`);
  }

  async function handleImportFile(file: File) {
    const outcome = importSessions(window.localStorage, await file.text());
    setSessions(listSessions(window.localStorage));
    void pousserTout();
    setNotice(
      outcome.error ??
        `Import : ${outcome.added} ajoutée${outcome.added > 1 ? "s" : ""}` +
          (outcome.skipped > 0 ? `, ${outcome.skipped} déjà présente${outcome.skipped > 1 ? "s" : ""}` : "") +
          (outcome.invalid > 0 ? `, ${outcome.invalid} ignorée${outcome.invalid > 1 ? "s" : ""}` : "") +
          ".",
    );
  }

  const trends = sessions !== null && sessions.length > 0 ? buildTrendReport(sessions) : null;
  const anyTrendUnlocked = trends?.some((t) => t.trend !== "absent") ?? false;
  const remaining =
    sessions === null ? 0 : Math.max(0, SEUILS_TENDANCES.minSessions - sessions.length);

  return (
    <>
      {sessions !== null && <ParcoursView sessions={sessions} onChange={() => void pousserTout()} />}

      {sessions !== null && sessions.length > 0 && (
        <div className="toolbar">
          <h2 className="list-title" style={{ margin: 0 }}>
            Tes sessions
          </h2>
          <div className="list-actions">
            <Link href="/app/slides" className="btn">
              📄 Mes slides
            </Link>
            <Link href="/app/repetition" className="btn">
              🎞️ Répéter avec mes slides
            </Link>
            <Link href="/app/session" className="btn primary">
              🎤 Nouvelle session
            </Link>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />

      {sessions === null ? null : sessions.length === 0 ? (
        <div className="onboarding">
          <h2 className="onboarding-title">Prépare ta soutenance, sérieusement.</h2>
          <p className="onboarding-lead">
            Tu t&apos;entraînes à l&apos;oral, l&apos;application t&apos;écoute et te donne des
            mesures objectives — puis elle se souvient de tes séances pour te montrer ce qui
            progresse et ce qui bloque.
          </p>

          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <div>
                <b>Choisis ton format</b>
                <p>PFA 15 min, PFE 20 min, ou entraînement libre.</p>
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <b>Parle comme devant le jury</b>
                <p>
                  Ton navigateur transcrit en direct. Autorise le micro quand il te le demande.
                </p>
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <b>Lis ton rapport</b>
                <p>
                  Débit, mots béquilles, structure, tenue du temps — chiffrés, pas commentés à
                  la louche.
                </p>
              </div>
            </li>
          </ol>

          <Link href="/app/session" className="btn primary big">
            🎤 Lancer ma première session
          </Link>

          <p className="onboarding-alt">
            Tu as déjà tes slides ?{" "}
            <Link href="/app/slides">Analyse-les et découvre les questions du jury →</Link>
          </p>

          <div className="reassure">
            <p>
              🔒 <b>Tes enregistrements restent ici.</b> Sans compte, tout vit dans ce navigateur.
              Avec un compte (optionnel), tes sessions te suivent sur tous tes appareils — jamais
              l&apos;audio, seulement les transcriptions.
            </p>
            <p>
              🧭 <b>Aucun chiffre n&apos;est inventé par une IA.</b> Chaque mesure est calculée
              par du code testé — et quand la transcription est mauvaise, l&apos;application le
              dit au lieu de deviner.
            </p>
            <p className="reassure-note">
              Fonctionne sur Chrome et Edge. Déjà des sessions sur un autre appareil ?
              <button className="link-btn" onClick={() => fileRef.current?.click()}>
                Importe ton fichier
              </button>
            </p>
          </div>
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

          <div className="list-head">
            <h2 className="list-title">Historique</h2>
            <div className="list-actions">
              <button className="btn small" onClick={handleExport}>
                ⬇ Exporter
              </button>
              <button className="btn small" onClick={() => fileRef.current?.click()}>
                ⬆ Importer
              </button>
            </div>
          </div>
          {sessions.map((s) => (
            <div key={s.id} className="card session-row">
              <div>
                <div className="session-meta">
                  {formatDate(s.startedAt)} · {formatDuration(s.durationMs)} · {s.wordCount} mots
                </div>
                <SessionChips session={s} />
                <div className="session-excerpt">{s.transcript || "(transcription vide)"}</div>
                <AvisCoach session={s} compact />
              </div>
              <button
                className="btn danger small"
                onClick={() => setConfirmingId(s.id)}
                aria-label={`Supprimer la session du ${formatDate(s.startedAt)}`}
              >
                Supprimer
              </button>
            </div>
          ))}
        </>
      )}

      {/* Sur une action destructive, l'action sûre reçoit le focus — jamais « Supprimer ». */}
      <ConfirmDialog
        ouverte={confirmingId !== null}
        onFermer={() => setConfirmingId(null)}
        onConfirmer={() => confirmingId && handleRemove(confirmingId)}
        titre="Supprimer cette session ?"
        message="La transcription et ses mesures seront effacées — ici, et sur ton compte si tu es connecté."
        libelleConfirmer="Supprimer"
        danger
      />
    </>
  );
}
