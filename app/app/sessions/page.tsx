"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { listSessions, removeSession, exportSessions, importSessions } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import type { SessionRecord } from "@/lib/types";
import AvisCoach from "@/app/components/AvisCoach";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { pousserTout, supprimerDistante, surSynchronisation } from "@/lib/sync/client";

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  return `${Math.floor(totalSec / 60)} min ${String(totalSec % 60).padStart(2, "0")} s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

const CHIP_UNITS: Record<string, string> = { temps: "min", debit: "mots/min", bequilles: "béq./100 mots", phrases: "mots/phrase" };
const FILTRES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "tous", label: "Tous" },
  { id: "soutenance", label: "🎓 Soutenance" },
  { id: "entretien", label: "💼 Entretien" },
  { id: "pitch", label: "🚀 Pitch" },
  { id: "concours", label: "🏛️ Concours" },
];

function SessionChips({ session }: { session: SessionRecord }) {
  const report = computeReport({ transcript: session.transcript, durationMs: session.durationMs, confidence: session.confidence, targetDurationMs: session.targetDurationMs });
  const chips = report.metrics.filter((m) => m.level !== "absent" && m.value !== undefined).map((m) => ({ id: m.id, level: m.level, text: `${m.value} ${CHIP_UNITS[m.id] ?? ""}`.trim() }));
  const avecSlides = session.slides && session.slides.length > 0;
  return (
    <div className="chips">
      <span className="chip chip-info">{FILTRES.find((f) => f.id === (session.mode ?? "soutenance"))?.label}</span>
      {avecSlides && <span className="chip chip-info">🎞️ {session.slides!.length} diapositives</span>}
      {chips.map((c) => (
        <span key={c.id} className={`chip chip-${c.level}`}>
          {c.text}
        </span>
      ))}
    </div>
  );
}

/** L'historique unifié : toutes les sessions, tous les modules, recherche et filtres. */
export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lire = () => setSessions(listSessions(window.localStorage));
    lire();
    return surSynchronisation(lire);
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
    toast.info(`${sessions.length} session${sessions.length > 1 ? "s" : ""} exportée${sessions.length > 1 ? "s" : ""}.`);
  }

  async function handleImportFile(file: File) {
    const outcome = importSessions(window.localStorage, await file.text());
    setSessions(listSessions(window.localStorage));
    void pousserTout();
    if (outcome.error) toast.error(outcome.error);
    else toast.success(`Import : ${outcome.added} ajoutée${outcome.added > 1 ? "s" : ""}${outcome.skipped > 0 ? `, ${outcome.skipped} déjà présente${outcome.skipped > 1 ? "s" : ""}` : ""}${outcome.invalid > 0 ? `, ${outcome.invalid} ignorée${outcome.invalid > 1 ? "s" : ""}` : ""}.`);
  }

  if (sessions === null) return null;

  const q = recherche.trim().toLowerCase();
  const visibles = sessions.filter((s) => (filtre === "tous" || (s.mode ?? "soutenance") === filtre) && (q === "" || s.transcript.toLowerCase().includes(q)));

  return (
    <>
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
      <div className="toolbar">
        <div className="filtres" role="group" aria-label="Filtrer par oral">
          {FILTRES.map((f) => (
            <button key={f.id} type="button" className={`format-btn${filtre === f.id ? " active" : ""}`} aria-pressed={filtre === f.id} onClick={() => setFiltre(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="list-actions">
          <button className="btn small" onClick={handleExport} disabled={sessions.length === 0}>
            ⬇ Exporter
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            ⬆ Importer
          </button>
          <Link href="/app/bilan" className="btn small">
            📄 Bilan
          </Link>
          <Link href="/app/session" className="btn small primary">
            🎤 Nouvelle session
          </Link>
        </div>
      </div>
      <label className="champ champ-large recherche">
        <span className="sr-only">Rechercher dans les transcriptions</span>
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un mot dans tes transcriptions…" />
      </label>
      <p className="session-meta" style={{ margin: "6px 0 14px" }}>
        {visibles.length} session{visibles.length > 1 ? "s" : ""}
        {visibles.length !== sessions.length && ` sur ${sessions.length}`}
      </p>

      {sessions.length === 0 ? (
        <div className="card teaser">
          Aucune session encore. <Link href="/app/session">Lance ta première</Link> — deux minutes suffisent. Déjà des sessions sur un autre appareil ?{" "}
          <button className="link-btn" onClick={() => fileRef.current?.click()}>
            Importe ton fichier
          </button>
        </div>
      ) : visibles.length === 0 ? (
        <div className="card teaser">Rien ne correspond à ce filtre.</div>
      ) : (
        visibles.map((s) => (
          <div key={s.id} className="card session-row">
            <div>
              <div className="session-meta">
                {formatDate(s.startedAt)} · {formatDuration(s.durationMs)} · {s.wordCount} mots
              </div>
              <SessionChips session={s} />
              <div className="session-excerpt">{s.transcript || "(transcription vide)"}</div>
              <AvisCoach session={s} compact />
            </div>
            <button className="btn danger small" onClick={() => setConfirmingId(s.id)} aria-label={`Supprimer la session du ${formatDate(s.startedAt)}`}>
              Supprimer
            </button>
          </div>
        ))
      )}

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
