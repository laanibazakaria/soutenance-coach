import Link from "next/link";
import type { SessionRecord } from "@/lib/types";
import { Icone, IconeBadge, type NomIcone, type Teinte } from "@/app/components/Icone";
import { debit } from "@/lib/accueil";

export const MODES: Record<string, { nom: string; icone: NomIcone; teinte: Teinte }> = {
  soutenance: { nom: "Soutenance", icone: "soutenance", teinte: "violet" },
  entretien: { nom: "Entretien", icone: "entretien", teinte: "bleu" },
  pitch: { nom: "Pitch", icone: "pitch", teinte: "or" },
  concours: { nom: "Concours", icone: "concours", teinte: "rose" },
};

export function modeDe(s: SessionRecord) {
  return MODES[s.mode ?? "soutenance"] ?? MODES.soutenance!;
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Une session en une ligne : pastille du module, titre, métadonnées, durée à
 * droite. Lien vers l'historique par défaut ; avec `onClick`, un bouton qui
 * déplie le détail (l'historique lui-même).
 */
export default function LigneSession({ session, href = "/app/sessions", onClick, ouvert }: { session: SessionRecord; href?: string; onClick?: () => void; ouvert?: boolean }) {
  const m = modeDe(session);
  const d = debit(session);
  const minutes = Math.round(session.durationMs / 60_000);
  const sec = Math.round(session.durationMs / 1000) % 60;
  const contenu = (
    <>
      <IconeBadge nom={m.icone} teinte={m.teinte} taille={38} />
      <span className="ligne-session-texte">
        <b>
          {m.nom} · {dateCourte(session.startedAt)} à {heure(session.startedAt)}
        </b>
        <small>
          {session.wordCount} mots{d !== null && ` · ${d} mots/min`}
          {session.slides && session.slides.length > 0 && ` · ${session.slides.length} diapositives`}
          {session.transcript.trim() === "" && " · transcription vide"}
        </small>
      </span>
      <span className="ligne-session-duree">{minutes > 0 ? `${minutes} min` : `${sec} s`}</span>
      <span className="ligne-session-action">
        {onClick ? (ouvert ? "Replier" : "Revoir") : "Revoir"} <Icone nom={onClick && ouvert ? "chevronBas" : "chevronDroite"} taille={14} />
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`ligne-session ligne-session-bouton${ouvert ? " ouverte" : ""}`} onClick={onClick} aria-expanded={ouvert}>
        {contenu}
      </button>
    );
  }
  return (
    <Link href={href} className="ligne-session">
      {contenu}
    </Link>
  );
}
