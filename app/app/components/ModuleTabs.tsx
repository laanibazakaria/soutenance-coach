"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Onglet {
  href: string;
  label: string;
  exact?: boolean;
}

/** Les onglets de chaque module : tout ce qui appartient au module vit dans le module. */
export const ONGLETS_MODULES: ReadonlyArray<{ id: string; racines: readonly string[]; onglets: readonly Onglet[] }> = [
  {
    id: "soutenance",
    racines: ["/app/soutenance", "/app/slides", "/app/repetition", "/app/fiches", "/app/jury", "/app/guide"],
    onglets: [
      { href: "/app/soutenance", label: "Préparer", exact: true },
      { href: "/app/slides", label: "Slides" },
      { href: "/app/repetition", label: "Répéter" },
      { href: "/app/fiches", label: "Fiches" },
      { href: "/app/jury", label: "Jury" },
      { href: "/app/guide", label: "Guide", exact: true },
    ],
  },
  {
    id: "entretien",
    racines: ["/app/entretien", "/app/guide-entretien"],
    onglets: [
      { href: "/app/entretien", label: "Préparer", exact: true },
      { href: "/app/entretien/simulation", label: "Simulation" },
      { href: "/app/guide-entretien", label: "Guide" },
    ],
  },
  {
    id: "pitch",
    racines: ["/app/m/pitch", "/app/guide-pitch"],
    onglets: [
      { href: "/app/m/pitch", label: "Préparer", exact: true },
      { href: "/app/m/pitch/simulation", label: "Simulation" },
      { href: "/app/guide-pitch", label: "Guide" },
    ],
  },
  {
    id: "concours",
    racines: ["/app/m/concours", "/app/guide-concours"],
    onglets: [
      { href: "/app/m/concours", label: "Préparer", exact: true },
      { href: "/app/m/concours/simulation", label: "Simulation" },
      { href: "/app/guide-concours", label: "Guide" },
    ],
  },
];

export function moduleDuChemin(chemin: string): (typeof ONGLETS_MODULES)[number] | null {
  return ONGLETS_MODULES.find((m) => m.racines.some((r) => chemin === r || chemin.startsWith(r + "/"))) ?? null;
}

export default function ModuleTabs() {
  const chemin = usePathname();
  const m = moduleDuChemin(chemin);
  if (!m) return null;
  return (
    <nav className="module-tabs" aria-label="Sections du module">
      <div className="module-tabs-inner">
        {m.onglets.map((o) => {
          const actif = o.exact ? chemin === o.href : chemin === o.href || chemin.startsWith(o.href + "/");
          return (
            <Link key={o.href} href={o.href} className={`module-tab${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
              {o.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
