import type { ScoreReport, MetricLevel } from "@/lib/scoring";

const LEVEL_LABEL: Record<MetricLevel, string> = {
  bon: "Bon",
  attention: "À surveiller",
  alerte: "À travailler",
  absent: "Non mesuré",
};

/** Rendu du rapport de scores — présentation pure, aucun calcul ici. */
export default function ScoreReportView({ report }: { report: ScoreReport }) {
  return (
    <section className="report" aria-label="Rapport de session">
      <h2 className="report-title">Ton rapport — {report.wordCount} mots analysés</h2>
      <div className="report-grid">
        {report.metrics.map((m) => (
          <article key={m.id} className={`metric metric-${m.level}`}>
            <header className="metric-head">
              <span className="metric-label">{m.label}</span>
              <span className={`badge badge-${m.level}`}>{LEVEL_LABEL[m.level]}</span>
            </header>
            {m.value !== undefined && (
              <div className="metric-value">
                {m.value} <span className="metric-unit">{m.unit}</span>
              </div>
            )}
            <p className="metric-summary">{m.summary}</p>
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
      <p className="report-note">
        Chaque verdict est calculé par du code déterministe et testé — jamais par une IA.
      </p>
    </section>
  );
}
