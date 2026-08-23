import Link from "next/link";

/** Gabarit des pages légales : lisible, sobre, un retour vers l'application. */
export default function PageLegale({
  titre,
  misAJour,
  children,
}: {
  titre: string;
  misAJour: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal">
      <header className="legal-head">
        <Link href="/" className="brand">
          <svg width="22" height="22" viewBox="0 0 150 150" aria-hidden="true">
            <g transform="translate(75,75)">
              <path
                d="M0,-62 L11,-15 L44,-44 L15,-11 L62,0 L15,11 L44,44 L11,15 L0,62 L-11,15 L-44,44 L-15,11 L-62,0 L-15,-11 L-44,-44 L-11,-15 Z"
                fill="none"
                stroke="#0f766e"
                strokeWidth="7"
              />
              <circle r="8" fill="#f59e0b" />
            </g>
          </svg>
          <span>
            Soutenance<b>Coach</b>
          </span>
        </Link>
        <nav className="legal-nav">
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/app" className="btn small primary">
            Ouvrir l&apos;application
          </Link>
        </nav>
      </header>
      <article className="legal-corps">
        <h1>{titre}</h1>
        <p className="legal-date">Dernière mise à jour : {misAJour}</p>
        {children}
      </article>
    </div>
  );
}
