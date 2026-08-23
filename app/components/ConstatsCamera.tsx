import { constats, type BilanCamera } from "@/lib/camera";
import { Icone, IconeBadge, type NomIcone, type Teinte } from "@/app/components/Icone";

const TEINTE: Record<string, Teinte> = { bon: "vert", attention: "or", alerte: "rouge", absent: "gris" };
const ICONE: Record<string, NomIcone> = { regard: "oeil", cadre: "image", sourire: "message", stabilite: "cible" };

/** Ce que la caméra a vu, en cartes — mêmes règles que le rapport : des chiffres, jamais de note. */
export default function ConstatsCamera({ bilan }: { bilan: BilanCamera }) {
  const liste = constats(bilan);
  return (
    <section className="report" aria-label="Ce que la caméra a vu">
      <div className="report-tete">
        <h3 className="report-title list-title">
          <Icone nom="oeil" taille={18} /> Ce que la caméra a vu
        </h3>
        <span className="session-meta">{bilan.exploitable ? `${bilan.images} images analysées sur ton appareil` : "aperçu insuffisant"}</span>
      </div>
      <div className="kpi-grille report-grille">
        {liste.map((c) => (
          <article key={`${c.id}-${c.label}`} className={`card kpi kpi-${c.niveau}`}>
            <div className="kpi-tete">
              <span className="kpi-label">{c.label}</span>
              <IconeBadge nom={ICONE[c.id] ?? "oeil"} teinte={TEINTE[c.niveau] ?? "gris"} taille={32} />
            </div>
            <span className={`kpi-valeur kpi-valeur-${c.niveau}`}>{c.valeur}</span>
            <p className="kpi-detail">{c.phrase}</p>
          </article>
        ))}
      </div>
      <p className="report-note">
        L&apos;image n&apos;a jamais quitté ton navigateur : elle n&apos;est ni envoyée, ni enregistrée. Seuls ces chiffres existent.
      </p>
    </section>
  );
}
