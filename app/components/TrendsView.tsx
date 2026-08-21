import type { TrendResult, TrendDirection } from "@/lib/trends";

const TREND_ICON: Record<TrendDirection, string> = {
  progression: "↗",
  stagnation: "→",
  regression: "↘",
  absent: "·",
};

const TREND_LABEL: Record<TrendDirection, string> = {
  progression: "En progression",
  stagnation: "Stable",
  regression: "En recul",
  absent: "À débloquer",
};

/** Rendu des tendances — présentation pure, tout est calculé dans lib/trends. */
export default function TrendsView({ trends }: { trends: TrendResult[] }) {
  return (
    <section aria-label="Ta progression" className="trends">
      <h2 className="trends-title">Ta progression</h2>
      <div className="trends-grid">
        {trends.map((t) => (
          <article key={t.id} className={`trend trend-${t.trend}`}>
            <header className="trend-head">
              <span className="trend-icon" aria-hidden="true">
                {TREND_ICON[t.trend]}
              </span>
              <div>
                <div className="trend-label">{t.label}</div>
                <div className={`trend-direction trend-direction-${t.trend}`}>
                  {TREND_LABEL[t.trend]}
                  {t.trend !== "absent" && ` · ${t.sessionsCount} sessions`}
                </div>
              </div>
            </header>
            <p className="trend-insight">{t.insight}</p>
          </article>
        ))}
      </div>
      <p className="report-note">
        Une tendance n&apos;est déclarée qu&apos;à partir de 3 sessions mesurables — en dessous,
        ce serait sur-interpréter du bruit.
      </p>
    </section>
  );
}
