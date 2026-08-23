"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountBar from "./AccountBar";

/* Icônes en traits fins (24×24, stroke 1.8) — même langage visuel que les outils pro. */
const I = {
  parcours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
  ),
  slides: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
  ),
  repeter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
  ),
  fiches: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
  ),
  jury: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  guide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  entretien: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
  ),
  pitch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>
  ),
  concours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 11h.01M15 11h.01" /></svg>
  ),
  micro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
  ),
};

const NAV: ReadonlyArray<{ href: string; label: string; icone: React.ReactNode; exact?: boolean }> = [
  { href: "/app", label: "Parcours", icone: I.parcours, exact: true },
  { href: "/app/slides", label: "Mes slides", icone: I.slides },
  { href: "/app/repetition", label: "Répéter", icone: I.repeter },
  { href: "/app/fiches", label: "Fiches", icone: I.fiches },
  { href: "/app/jury", label: "Jury", icone: I.jury },
];

const ENTRETIEN: ReadonlyArray<{ href: string; label: string; icone: React.ReactNode; exact?: boolean }> = [
  { href: "/app/entretien", label: "Mon entretien", icone: I.entretien, exact: true },
  { href: "/app/entretien/simulation", label: "Simulation", icone: I.jury },
  { href: "/app/guide-entretien", label: "Guide entretien", icone: I.guide },
];

const MODULES_NAV: ReadonlyArray<{ section: string; liens: ReadonlyArray<{ href: string; label: string; icone: React.ReactNode; exact?: boolean }> }> = [
  {
    section: "Pitch de projet",
    liens: [
      { href: "/app/m/pitch", label: "Mon pitch", icone: I.pitch, exact: true },
      { href: "/app/m/pitch/simulation", label: "Simulation", icone: I.jury },
      { href: "/app/guide-pitch", label: "Guide pitch", icone: I.guide },
    ],
  },
  {
    section: "Oral de concours",
    liens: [
      { href: "/app/m/concours", label: "Mon oral", icone: I.concours, exact: true },
      { href: "/app/m/concours/simulation", label: "Simulation", icone: I.jury },
      { href: "/app/guide-concours", label: "Guide concours", icone: I.guide },
    ],
  },
];

const RESSOURCES: ReadonlyArray<{ href: string; label: string; icone: React.ReactNode }> = [
  { href: "/app/guide", label: "Guide soutenance", icone: I.guide },
];

function estActif(chemin: string, href: string, exact?: boolean): boolean {
  return exact ? chemin === href : chemin.startsWith(href);
}

export function Marque({ taille = 24 }: { taille?: number }) {
  return (
    <Link href="/" className="brand">
      <svg width={taille} height={taille} viewBox="0 0 150 150" aria-hidden="true">
        <g transform="translate(75,75)">
          <path
            d="M0,-62 L11,-15 L44,-44 L15,-11 L62,0 L15,11 L44,44 L11,15 L0,62 L-11,15 L-44,44 L-15,11 L-62,0 L-15,-11 L-44,-44 L-11,-15 Z"
            fill="none"
            stroke="#6f00ff"
            strokeWidth="7"
          />
          <circle r="8" fill="#ffd700" />
        </g>
      </svg>
      <span>
        Soutenance<b>Coach</b>
      </span>
    </Link>
  );
}

/** Barre latérale (bureau) : navigation par sections, action principale, compte. */
export default function Sidebar() {
  const chemin = usePathname();
  return (
    <aside className="sidebar" aria-label="Navigation principale">
      <div className="sidebar-brand">
        <Marque taille={26} />
      </div>

      <div className="sidebar-section">Soutenance</div>
      {NAV.map((l) => {
        const actif = estActif(chemin, l.href, l.exact);
        return (
          <Link key={l.href} href={l.href} className={`sidebar-link${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
            <span className="sidebar-icone">{l.icone}</span>
            {l.label}
          </Link>
        );
      })}

      <div className="sidebar-section">Entretien d&apos;embauche</div>
      {ENTRETIEN.map((l) => {
        const actif = estActif(chemin, l.href, l.exact);
        return (
          <Link key={l.href} href={l.href} className={`sidebar-link${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
            <span className="sidebar-icone">{l.icone}</span>
            {l.label}
          </Link>
        );
      })}

      {MODULES_NAV.map((groupe) => (
        <div key={groupe.section}>
          <div className="sidebar-section">{groupe.section}</div>
          {groupe.liens.map((l) => {
            const actif = estActif(chemin, l.href, l.exact);
            return (
              <Link key={l.href} href={l.href} className={`sidebar-link${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
                <span className="sidebar-icone">{l.icone}</span>
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="sidebar-section">Ressources</div>
      {RESSOURCES.map((l) => {
        const actif = estActif(chemin, l.href);
        return (
          <Link key={l.href} href={l.href} className={`sidebar-link${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
            <span className="sidebar-icone">{l.icone}</span>
            {l.label}
          </Link>
        );
      })}

      <div className="sidebar-bas">
        <Link href="/app/session" className="btn primary sidebar-cta">
          <span className="sidebar-icone">{I.micro}</span>
          Nouvelle session
        </Link>
        <div className="sidebar-account">
          <AccountBar />
        </div>
        <nav className="sidebar-legal" aria-label="Informations légales">
          <Link href="/confidentialite">Confidentialité</Link>
          <span aria-hidden="true">·</span>
          <Link href="/mentions-legales">Mentions légales</Link>
        </nav>
      </div>
    </aside>
  );
}

/** Onglets du bas (mobile) : les quatre sections + l'enregistrement au centre. */
export function OngletsMobiles() {
  const chemin = usePathname();
  const gauche = NAV.slice(0, 2);
  const droite = NAV.slice(3, 5);
  const onglet = (l: (typeof NAV)[number]) => {
    const actif = estActif(chemin, l.href, l.exact);
    return (
      <Link key={l.href} href={l.href} className={`mobile-tab${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
        <span className="sidebar-icone">{l.icone}</span>
        {l.label.replace("Mes ", "")}
      </Link>
    );
  };
  return (
    <nav className="mobile-tabs" aria-label="Sections">
      {gauche.map(onglet)}
      <Link href="/app/session" className="mobile-tab mobile-tab-record" aria-label="Nouvelle session">
        <span className="mobile-record">{I.micro}</span>
      </Link>
      {droite.map(onglet)}
    </nav>
  );
}
