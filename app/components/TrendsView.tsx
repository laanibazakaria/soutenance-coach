import type { TrendResult, TrendDirection } from "@/lib/trends";
import { Icone, IconeBadge, type NomIcone, type Teinte } from "@/app/components/Icone";

const TREND_LABEL: Record<TrendDirection, string> = {
  progression: "En progression",
  stagnation: "Stable",
  regression: "En recul",
  absent: "À débloquer",
};

const TEINTE: Record<TrendDirection, Teinte> = { progression: "vert", stagnation: "or", regression: "rouge", absent: "gris" };
const ICONE: Record<TrendDirection, NomIcone> = { progression: "tendance", stagnation: "fleche", regression: "chevronBas", absent: "cadenas" };
const UNITES: Record<string, string> = { temps: "min", debit: "mots/min", bequilles: "béq./100 mots", phrases: "mots/phrase", structure: "" };

/** Rendu des tendances en cartes KPI — présentation pure, tout est calculé dans lib/trends. */
export default function TrendsView({ trends }: { trends: TrendResult[] }) {
  return (
    <section aria-label="Ta progression" className="trends">
      <h2 className="trends-title list-title">
        <Icone nom="graphique" taille={18} /> Ta progression
      </h2>
      <div className="kpi-grille">
        {trends.map((t) => {
          const valeur = t.lastValue;
          const unite = UNITES[t.id] ?? "";
          return (
            <article key={t.id} className={`card kpi kpi-${t.trend}`}>
              <div className="kpi-tete">
                <span className="kpi-label">{t.label}</span>
                <IconeBadge nom={ICONE[t.trend]} teinte={TEINTE[t.trend]} taille={32} />
              </div>
              <span className={`kpi-valeur kpi-valeur-${t.trend}`}>
                {valeur !== undefined ? (
                  <>
                    {typeof valeur === "number" ? valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : valeur}
                    {unite && <small> {unite}</small>}
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className={`kpi-direction kpi-direction-${t.trend}`}>
                {TREND_LABEL[t.trend]}
                {t.trend !== "absent" && ` · ${t.sessionsCount} sessions`}
                {t.trend !== "absent" && t.firstValue !== undefined && t.firstValue !== t.lastValue && ` · ${t.firstValue} → ${t.lastValue}`}
              </span>
              <p className="kpi-detail">{t.insight}</p>
            </article>
          );
        })}
      </div>
      <p className="report-note">
        Une tendance n&apos;est déclarée qu&apos;à partir de 3 sessions mesurables — en dessous,
        ce serait sur-interpréter du bruit.
      </p>
    </section>
  );
}
