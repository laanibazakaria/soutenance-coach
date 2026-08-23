import type { ScoreReport, MetricLevel } from "@/lib/scoring";
import { Icone, IconeBadge, type NomIcone, type Teinte } from "@/app/components/Icone";

const LEVEL_LABEL: Record<MetricLevel, string> = {
  bon: "Bon",
  attention: "À surveiller",
  alerte: "À travailler",
  absent: "Non mesuré",
};
const TEINTE: Record<MetricLevel, Teinte> = { bon: "vert", attention: "or", alerte: "rouge", absent: "gris" };
const ICONE: Record<MetricLevel, NomIcone> = { bon: "valide", attention: "alerte", alerte: "alerte", absent: "cadenas" };

/** Rendu du rapport de scores en cartes KPI — présentation pure, aucun calcul ici. */
export default function ScoreReportView({ report }: { report: ScoreReport }) {
  const bons = report.metrics.filter((m) => m.level === "bon").length;
  const mesures = report.metrics.filter((m) => m.level !== "absent").length;
  return (
    <section className="report" aria-label="Rapport de session">
      <div className="report-tete">
        <h2 className="report-title list-title">
          <Icone nom="graphique" taille={18} /> Ton rapport
        </h2>
        <span className="session-meta">
          {report.wordCount} mots analysés · {bons}/{mesures} au vert
        </span>
      </div>
      <div className="kpi-grille report-grille">
        {report.metrics.map((m) => (
          <article key={m.id} className={`card kpi kpi-${m.level}`}>
            <div className="kpi-tete">
              <span className="kpi-label">{m.label}</span>
              <IconeBadge nom={ICONE[m.level]} teinte={TEINTE[m.level]} taille={32} />
            </div>
            <span className={`kpi-valeur kpi-valeur-${m.level}`}>
              {m.value !== undefined ? (
                <>
                  {m.value}
                  {m.unit && <small> {m.unit}</small>}
                </>
              ) : (
                "—"
              )}
            </span>
            <span className={`kpi-direction kpi-direction-${m.level}`}>{LEVEL_LABEL[m.level]}</span>
            <p className="kpi-detail">{m.summary}</p>
            {m.details.length > 0 && (
              <ul className="metric-details">
                {m.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
      <p className="report-note">Chaque verdict est calculé par du code déterministe et testé — jamais par une IA.</p>
    </section>
  );
}
