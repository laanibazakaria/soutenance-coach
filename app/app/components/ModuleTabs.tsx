"use client";

import { useEffect, useRef } from "react";
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
    racines: ["/app/soutenance", "/app/slides", "/app/repetition", "/app/fiches", "/app/jury", "/app/guide", "/app/soutenance-blanche"],
    onglets: [
      { href: "/app/soutenance", label: "Préparer", exact: true },
      { href: "/app/slides", label: "Slides" },
      { href: "/app/repetition", label: "Répéter" },
      { href: "/app/fiches", label: "Fiches" },
      { href: "/app/soutenance-blanche", label: "Soutenance blanche" },
      { href: "/app/appel?mode=soutenance", label: "Appel avec le jury" },
      { href: "/app/guide", label: "Guide", exact: true },
    ],
  },
  {
    id: "entretien",
    racines: ["/app/entretien", "/app/guide-entretien"],
    onglets: [
      { href: "/app/entretien", label: "Préparer", exact: true },
      { href: "/app/appel?mode=entretien", label: "Appel avec le jury" },
      { href: "/app/guide-entretien", label: "Guide" },
    ],
  },
];

export function moduleDuChemin(chemin: string): (typeof ONGLETS_MODULES)[number] | null {
  return ONGLETS_MODULES.find((m) => m.racines.some((r) => chemin === r || chemin.startsWith(r + "/"))) ?? null;
}

export default function ModuleTabs() {
  const chemin = usePathname();
  const bande = useRef<HTMLDivElement>(null);
  const m = moduleDuChemin(chemin);

  // Sept onglets tiennent sur 550 px ; un téléphone en montre 375. Sans cela,
  // l'onglet où l'on se trouve peut rester hors de l'écran — on ne sait plus
  // dans quelle section on est.
  useEffect(() => {
    const el = bande.current?.querySelector(".module-tab.active");
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [chemin]);

  if (!m) return null;
  return (
    <nav className="module-tabs" aria-label="Sections du module">
      <div className="module-tabs-inner" ref={bande}>
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
