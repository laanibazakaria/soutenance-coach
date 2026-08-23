"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIENS: ReadonlyArray<{ href: string; label: string; exact?: boolean }> = [
  { href: "/app", label: "Parcours", exact: true },
  { href: "/app/slides", label: "Slides" },
  { href: "/app/repetition", label: "Répéter" },
  { href: "/app/fiches", label: "Fiches" },
  { href: "/app/jury", label: "Jury" },
];

/** Navigation principale de l'application, sous la barre de compte. */
export default function AppNav() {
  const chemin = usePathname();
  return (
    <nav className="appnav" aria-label="Sections">
      {LIENS.map((l) => {
        const actif = l.exact ? chemin === l.href : chemin.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`appnav-lien${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
