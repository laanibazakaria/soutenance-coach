/**
 * Squelettes de chargement : un placeholder qui préfigure la forme du contenu
 * réel, à la place d'un « Chargement… » ou d'un écran vide qui saute.
 */

export default function Skeleton({
  largeur = "100%",
  hauteur = 24,
  rayon = 8,
  style,
}: {
  largeur?: string | number;
  hauteur?: number;
  rayon?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" aria-hidden="true" style={{ width: largeur, height: hauteur, borderRadius: rayon, ...style }} />;
}

/** Carte générique — titre court et deux lignes. */
export function SkeletonCarte() {
  return (
    <div className="card" aria-hidden="true">
      <Skeleton largeur="55%" hauteur={14} />
      <div style={{ marginTop: 12 }}>
        <Skeleton largeur="90%" hauteur={12} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Skeleton largeur="40%" hauteur={12} />
      </div>
    </div>
  );
}

/** Bloc de texte — lignes de largeur décroissante. */
export function SkeletonTexte({ lignes = 3 }: { lignes?: number }) {
  const largeurs = ["100%", "95%", "70%"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-hidden="true">
      {Array.from({ length: lignes }).map((_, i) => (
        <Skeleton key={i} hauteur={14} largeur={largeurs[i % largeurs.length]} />
      ))}
    </div>
  );
}
