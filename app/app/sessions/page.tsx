"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { listSessions, removeSession, exportSessions, importSessions } from "@/lib/storage";
import { computeReport } from "@/lib/scoring";
import type { SessionRecord } from "@/lib/types";
import AvisCoach from "@/app/components/AvisCoach";
import LecteurAudio from "@/app/components/LecteurAudio";
import TranscriptAnnote from "@/app/components/TranscriptAnnote";
import { supprimerAudio } from "@/lib/audio/stockage";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { useToast } from "@/app/components/Toast";
import { lireCache } from "@/lib/ia-cache";
import { pousserTout, supprimerDistante, surSynchronisation } from "@/lib/sync/client";
import { Icone } from "@/app/components/Icone";
import LigneSession from "../components/LigneSession";
import EtatVide from "@/app/components/EtatVide";

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  return `${Math.floor(totalSec / 60)} min ${String(totalSec % 60).padStart(2, "0")} s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

const CHIP_UNITS: Record<string, string> = { temps: "min", debit: "mots/min", bequilles: "béq./100 mots", phrases: "mots/phrase" };
const FILTRES: ReadonlyArray<{ id: string; label: React.ReactNode }> = [
  { id: "tous", label: "Tous" },
  { id: "soutenance", label: <><Icone nom="soutenance" /> Soutenance</> },
  { id: "entretien", label: <><Icone nom="entretien" /> Entretien</> },
  { id: "pitch", label: <><Icone nom="pitch" /> Pitch</> },
  { id: "concours", label: <><Icone nom="concours" /> Concours</> },
];

function SessionChips({ session }: { session: SessionRecord }) {
  const report = computeReport({ transcript: session.transcript, durationMs: session.durationMs, confidence: session.confidence, targetDurationMs: session.targetDurationMs });
  const chips = report.metrics.filter((m) => m.level !== "absent" && m.value !== undefined).map((m) => ({ id: m.id, level: m.level, text: `${m.value} ${CHIP_UNITS[m.id] ?? ""}`.trim() }));
  const avecSlides = session.slides && session.slides.length > 0;
  return (
    <div className="chips">
      <span className="chip chip-info">{FILTRES.find((f) => f.id === (session.mode ?? "soutenance"))?.label}</span>
      {avecSlides && <span className="chip chip-info"><Icone nom="slides" /> {session.slides!.length} diapositives</span>}
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
  return (
    <Suspense fallback={null}>
      <SessionsInner />
    </Suspense>
  );
}

function SessionsInner() {
  const params = useSearchParams();
  const qUrl = params.get("q") ?? "";
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lire = () => setSessions(listSessions(window.localStorage));
    lire();
    return surSynchronisation(lire);
  }, []);
  useEffect(() => {
    if (qUrl) setRecherche(qUrl);
  }, [qUrl]);

  function handleRemove(id: string) {
    setSessions(removeSession(window.localStorage, id));
    void supprimerDistante(id);
    void supprimerAudio(id);
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
            <Icone nom="telecharger" /> Exporter
          </button>
          <Link href="/app/bilan" className="btn small">
            <Icone nom="document" /> Bilan
          </Link>
        </div>
      </div>
      <label className="champ champ-large recherche">
        <span className="sr-only">Rechercher dans les transcriptions</span>
        <input type="search" name="q" autoComplete="off" spellCheck={false} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un mot dans tes transcriptions…" />
      </label>
      <p className="session-meta" style={{ margin: "6px 0 14px" }} aria-live="polite">
        {visibles.length} session{visibles.length > 1 ? "s" : ""}
        {visibles.length !== sessions.length && ` sur ${sessions.length}`}
      </p>

      {sessions.length === 0 ? (
        <EtatVide
          icone="sessions"
          titre="Aucune session pour l'instant"
          texte="Chaque répétition enregistrée apparaîtra ici, avec ses mesures, sa transcription annotée et l'avis du coach."
          action={{ libelle: "Lancer ma première session →", href: "/app/session" }}
          secondaire={
            <>
              Déjà des sessions sur un autre appareil ?{" "}
              <button className="link-btn" onClick={() => fileRef.current?.click()}>
                Importe ton fichier
              </button>
            </>
          }
        />
      ) : visibles.length === 0 ? (
        <EtatVide icone="recherche" teinte="gris" titre="Rien ne correspond" texte="Essaie un autre mot, ou retire le filtre par oral." />
      ) : (
        <div className="lignes-sessions">
          {visibles.map((s) => {
            const estOuverte = ouverte === s.id;
            return (
              <article key={s.id} className={`ligne-session-carte${estOuverte ? " ouverte" : ""}`}>
                <LigneSession session={s} onClick={() => setOuverte(estOuverte ? null : s.id)} ouvert={estOuverte} />
                {estOuverte && (
                  <div className="ligne-session-detail">
                    <SessionChips session={s} />
                    {s.transcript ? <TranscriptAnnote transcript={s.transcript} titre="" /> : <p className="session-meta">(transcription vide)</p>}
                    {lireCache(window.localStorage, `appel:${s.id}`) !== null && (
                      <Link href={`/app/appel/debrief/${s.id}`} className="btn small" style={{ marginTop: 8 }}>
                        <Icone nom="appel" /> Débrief de l&apos;appel avec le jury →
                      </Link>
                    )}
                    {lireCache(window.localStorage, `blanche:${s.id}`) !== null && (
                      <Link href={`/app/soutenance-blanche?session=${s.id}`} className="btn small" style={{ marginTop: 8 }}>
                        <Icone nom="soutenance" /> Débrief de la soutenance blanche →
                      </Link>
                    )}
                    <LecteurAudio sessionId={s.id} mesures={s.audio} compact />
                    <AvisCoach session={s} compact />
                    <div className="ligne-session-pied">
                      <span className="session-meta">{formatDate(s.startedAt)} · {formatDuration(s.durationMs)}</span>
                      <button className="btn danger small" onClick={() => setConfirmingId(s.id)} aria-label={`Supprimer la session du ${formatDate(s.startedAt)}`}>
                        <Icone nom="corbeille" /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
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
