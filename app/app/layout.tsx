import Link from "next/link";

/** Layout de l'application : barre supérieure commune au tableau de bord et aux sessions. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 150 150" aria-hidden="true">
            <g transform="translate(75,75)">
              <path
                d="M0,-62 L11,-15 L44,-44 L15,-11 L62,0 L15,11 L44,44 L11,15 L0,62 L-11,15 L-44,44 L-15,11 L-62,0 L-15,-11 L-44,-44 L-11,-15 Z"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="7"
              />
              <circle r="8" fill="#D4AF37" />
            </g>
          </svg>
          SoutenanceCoach
        </Link>
        <span className="privacy-note">100 % local — rien ne quitte ton navigateur</span>
      </header>
      <main className="content">{children}</main>
    </>
  );
}
