import type { Bilan } from "@/lib/bilan";

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const MODES: Record<string, string> = { soutenance: "Soutenance", entretien: "Entretien", pitch: "Pitch", concours: "Concours" };
const TENDANCES: Record<string, string> = { progression: "En progression", stagnation: "Stable", regression: "En recul" };

/** Le rendu du bilan — le même à l'écran, à l'impression et en partage. */
export default function BilanVue({ bilan }: { bilan: Bilan }) {
  const date = new Date(bilan.genereLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return (
    <article className="bilan">
      <header className="bilan-tete">
        <div>
          <h1>Bilan de préparation{bilan.prenom ? ` — ${bilan.prenom}` : ""}</h1>
          <p className="session-meta">Généré le {date} par SoutenanceCoach · chiffres calculés par du code, jamais par une IA</p>
        </div>
      </header>

      <section className="bilan-section">
        <h2>Où en est la préparation</h2>
        <div className="bilan-grille">
          {bilan.modules.map((m) => (
            <div key={m.id} className="bilan-carte">
              <b>
                {m.emoji} {m.nom}
              </b>
              <p className="session-meta">{m.sousTitre}</p>
              {m.pourcent !== null ? (
                <p>
                  <b>Prêt à {m.pourcent} %</b>
                  {m.jours !== null && m.jours >= 0 && ` · J-${m.jours}`}
                </p>
              ) : (
                <p className="session-meta">Pas encore commencé</p>
              )}
              <p className="session-meta">Prochaine étape : {m.prochaineAction.titre}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bilan-section">
        <h2>Les sessions</h2>
        <p>
          <b>{bilan.sessions.total}</b> session{bilan.sessions.total > 1 ? "s" : ""}, <b>{bilan.sessions.minutesParlees}</b> minutes parlées.
        </p>
        {bilan.sessions.dernieres.length > 0 && (
          <table className="bilan-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Oral</th>
                <th>Durée</th>
                <th>Mots</th>
                <th>Débit</th>
                <th>Béquilles / 100 mots</th>
              </tr>
            </thead>
            <tbody>
              {bilan.sessions.dernieres.map((s) => (
                <tr key={s.date}>
                  <td>{new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</td>
                  <td>{MODES[s.mode] ?? s.mode}</td>
                  <td>{s.dureeMin} min</td>
                  <td>{s.mots}</td>
                  <td>{s.debit !== undefined ? `${s.debit} mots/min` : "—"}</td>
                  <td>{s.bequilles !== undefined ? s.bequilles : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {bilan.tendances.length > 0 && (
        <section className="bilan-section">
          <h2>Les tendances</h2>
          <ul className="bilan-liste">
            {bilan.tendances.map((t) => (
              <li key={t.id}>
                <b>{t.label}</b> — {TENDANCES[t.trend] ?? t.trend} · {t.insight}
              </li>
            ))}
          </ul>
        </section>
      )}

      {bilan.support && (
        <section className="bilan-section">
          <h2>Le support</h2>
          <p>
            <b>{bilan.support.nomFichier}</b> · {bilan.support.slides} diapositives
          </p>
          {bilan.support.repetition && (
            <>
              <p className="session-meta">Dernière répétition avec les slides, le {new Date(bilan.support.repetition.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} — {bilan.support.repetition.resume}</p>
              <table className="bilan-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Diapositive</th>
                    <th>Prévu</th>
                    <th>Réel</th>
                  </tr>
                </thead>
                <tbody>
                  {bilan.support.repetition.lignes.map((l) => (
                    <tr key={l.numero} className={`bilan-${l.niveau}`}>
                      <td>{l.numero}</td>
                      <td>{l.titre}</td>
                      <td>{mmss(l.prevuMs)}</td>
                      <td>{l.niveau === "non-vue" ? "non vue" : mmss(l.reelMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {bilan.fiches && (
        <section className="bilan-section">
          <h2>Les fiches à mémoriser</h2>
          <p>
            {bilan.fiches.total} fiches · <b>{bilan.fiches.acquises} acquises</b> · {bilan.fiches.dues} à revoir
          </p>
        </section>
      )}

      <footer className="bilan-pied">
        <p className="session-meta">SoutenanceCoach — soutenance-coach.vercel.app. Ce bilan ne contient aucune transcription ni aucun document.</p>
      </footer>
    </article>
  );
}
