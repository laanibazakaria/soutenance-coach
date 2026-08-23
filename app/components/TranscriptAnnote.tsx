"use client";

import { annoterTranscription, resumeAnnotation } from "@/lib/scoring/annotation";

/** La transcription, avec chaque béquille surlignée là où elle a été dite. */
export default function TranscriptAnnote({ transcript, titre = "Ta transcription, annotée" }: { transcript: string; titre?: string }) {
  const segments = annoterTranscription(transcript);
  const resume = resumeAnnotation(segments);
  if (transcript.trim() === "") return null;
  return (
    <div className="annote">
      <div className="annote-tete">
        <b>{titre}</b>
        <span className="session-meta">
          {resume.total === 0 ? "aucune béquille — propre" : `${resume.total} béquille${resume.total > 1 ? "s" : ""} : ${resume.parCanonique.slice(0, 4).map((p) => `${p.canonique} ×${p.n}`).join(", ")}${resume.parCanonique.length > 4 ? "…" : ""}`}
        </span>
      </div>
      <div className="transcript annote-texte">
        {segments.map((s, i) =>
          s.type === "bequille" ? (
            <mark key={i} className="beq" title={`béquille : ${s.canonique}`}>
              {s.texte}
            </mark>
          ) : (
            <span key={i}>{s.texte}</span>
          ),
        )}
      </div>
    </div>
  );
}
