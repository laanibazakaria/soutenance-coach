import Link from "next/link";
import Image from "next/image";
import accueil from "@/docs/accueil.png";
import session from "@/docs/session.png";

const METRIQUES = [
  {
    icone: "⏱️",
    titre: "Tenue du temps",
    texte:
      "Format PFA 15 min ou PFE 20 min : le minuteur passe à l'orange dans les dernières minutes, au rouge au dépassement. Un jury coupe — coupe avant lui.",
  },
  {
    icone: "🗣️",
    titre: "Débit de parole",
    texte:
      "Mots par minute, comparés à la zone confortable d'un exposé (110-160). Trop lent, le jury décroche ; trop rapide, il ne suit plus.",
  },
  {
    icone: "🎯",
    titre: "Mots béquilles",
    texte:
      "« euh », « du coup », « en fait », « voilà »… comptés pour 100 mots, avec le détail de ceux qui reviennent le plus. Ceux qu'on n'entend jamais soi-même.",
  },
  {
    icone: "🧭",
    titre: "Structure annoncée",
    texte:
      "Est-ce que tu annonces ton plan en introduction ? Est-ce que ta conclusion est marquée ? Le jury doit toujours savoir où tu en es.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      {/* ── barre de navigation ── */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <span className="lp-brand">
            <svg width="26" height="26" viewBox="0 0 150 150" aria-hidden="true">
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
          </span>
          <div className="lp-nav-links">
            <a href="#fonctionnement">Comment ça marche</a>
            <a href="#mesures">Ce qui est mesuré</a>
            <a
              href="https://github.com/laanibazakaria/soutenance-coach"
              target="_blank"
              rel="noopener"
            >
              Code source
            </a>
            <Link href="/app" className="btn primary small">
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* ── hero ── */}
      <header className="lp-hero">
        <div className="lp-container">
          <span className="lp-badge">Gratuit · Sans compte · Open source</span>
          <h1 className="lp-title">
            Prépare ta soutenance
            <br />
            <span className="lp-title-accent">avec des chiffres, pas des impressions.</span>
          </h1>
          <p className="lp-lead">
            Tu t&apos;entraînes à l&apos;oral, l&apos;application t&apos;écoute et mesure ce qu&apos;un
            jury remarquera : ton débit, tes mots béquilles, ta structure, ta tenue du temps.
            Puis elle se souvient de tes séances — et te montre ce qui progresse vraiment.
          </p>
          <div className="lp-cta">
            <Link href="/app" className="btn primary big">
              🎤 Commencer mon entraînement
            </Link>
            <a href="#fonctionnement" className="btn big">
              Voir comment ça marche
            </a>
          </div>
          <p className="lp-hint">
            Fonctionne sur Chrome et Edge · Rien à installer · Tes enregistrements restent sur ton
            appareil
          </p>
          <div className="lp-shot">
            <Image src={accueil} alt="L'écran d'accueil de SoutenanceCoach" priority />
          </div>
        </div>
      </header>

      {/* ── le problème ── */}
      <section className="lp-section lp-problem">
        <div className="lp-container lp-narrow">
          <h2 className="lp-h2">Le miroir ne te dit pas la vérité</h2>
          <p className="lp-p">
            Tu répètes devant ton miroir, ou devant un ami qui te dit « c&apos;était bien ». Personne
            ne peut te dire que tu as prononcé <b>onze fois « du coup »</b>, que tu as parlé à
            47 mots par minute, ou que tu n&apos;as jamais annoncé ton plan. Et surtout : personne ne
            se souvient de ta séance d&apos;il y a trois jours pour te dire si tu progresses.
          </p>
          <p className="lp-p">
            <b>C&apos;est exactement ce que fait cette application</b> — et rien d&apos;autre.
          </p>
        </div>
      </section>

      {/* ── fonctionnement ── */}
      <section className="lp-section" id="fonctionnement">
        <div className="lp-container">
          <h2 className="lp-h2 lp-center">Trois étapes, deux minutes</h2>
          <div className="lp-steps">
            <article>
              <span className="lp-step-num">1</span>
              <h3>Choisis ton format</h3>
              <p>
                PFA 15 min, PFE 20 min, pitch 5 min, ou entraînement libre. Le minuteur t&apos;aide
                à tenir le cadre imposé par ton jury.
              </p>
            </article>
            <article>
              <span className="lp-step-num">2</span>
              <h3>Parle comme devant le jury</h3>
              <p>
                Ton navigateur transcrit en direct pendant que tu présentes. Tu lis ton texte
                défiler, exactement comme le jury t&apos;entend.
              </p>
            </article>
            <article>
              <span className="lp-step-num">3</span>
              <h3>Lis ton rapport</h3>
              <p>
                Quatre mesures chiffrées, chacune expliquée, avec un conseil concret. Puis
                recommence — c&apos;est à la troisième séance que ça devient intéressant.
              </p>
            </article>
          </div>
          <div className="lp-shot lp-shot-narrow">
            <Image src={session} alt="L'écran de session avec les formats PFA et PFE" />
          </div>
        </div>
      </section>

      {/* ── mesures ── */}
      <section className="lp-section lp-alt" id="mesures">
        <div className="lp-container">
          <h2 className="lp-h2 lp-center">Ce qui est mesuré</h2>
          <p className="lp-sub lp-center">
            Quatre indicateurs qu&apos;un jury remarque — et que tu ne perçois pas toi-même.
          </p>
          <div className="lp-grid">
            {METRIQUES.map((m) => (
              <article key={m.titre} className="lp-card">
                <span className="lp-card-icon" aria-hidden="true">
                  {m.icone}
                </span>
                <h3>{m.titre}</h3>
                <p>{m.texte}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── la mémoire ── */}
      <section className="lp-section">
        <div className="lp-container lp-split">
          <div>
            <span className="lp-eyebrow">La différence</span>
            <h2 className="lp-h2">Un coach qui se souvient</h2>
            <p className="lp-p">
              Une note isolée ne dit rien. Ce qui compte, c&apos;est la tendance : est-ce que tes
              béquilles diminuent ? est-ce que ton débit se stabilise ? est-ce que tu bloques
              toujours au même endroit ?
            </p>
            <p className="lp-p">
              À partir de <b>trois séances</b>, l&apos;application compare et te dit franchement ce
              qui progresse, ce qui stagne, et ce qui recule.
            </p>
            <p className="lp-quote">
              « En progression : 9,3 → 0 béquilles pour 100 mots sur 3 sessions. »
            </p>
          </div>
          <div className="lp-trend-demo">
            <div className="lp-trend lp-trend-up">
              <span className="lp-trend-icon">↗</span>
              <div>
                <b>Mots béquilles</b>
                <span>En progression · 3 sessions</span>
              </div>
            </div>
            <div className="lp-trend lp-trend-flat">
              <span className="lp-trend-icon">→</span>
              <div>
                <b>Structure annoncée</b>
                <span>Stagne — c&apos;est TON point prioritaire</span>
              </div>
            </div>
            <div className="lp-trend lp-trend-locked">
              <span className="lp-trend-icon">🔒</span>
              <div>
                <b>Tenue du temps</b>
                <span>Encore 2 séances pour débloquer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── philosophie ── */}
      <section className="lp-section lp-alt">
        <div className="lp-container lp-narrow">
          <span className="lp-eyebrow">Ce qui rend cet outil différent</span>
          <h2 className="lp-h2">Aucun chiffre n&apos;est inventé par une IA</h2>
          <p className="lp-p">
            Un modèle de langage se trompe de manière <i>plausible</i> : une note fausse ressemble à
            une note juste, et rien ne la distingue. Ici, <b>chaque mesure est calculée par du code
            déterministe et testé</b> — 81 tests automatisés le vérifient à chaque modification.
          </p>
          <p className="lp-p">
            Et quand les données ne suffisent pas, l&apos;application <b>s&apos;abstient</b> : elle
            affiche « non mesuré » et explique pourquoi, plutôt que de produire un verdict sur du
            bruit. Une transcription hachée ne prouve pas des phrases courtes ; un micro qui a mal
            capté ne prouve pas que tu parles lentement.
          </p>
          <div className="lp-pills">
            <span className="lp-pill">🔒 Aucune donnée envoyée</span>
            <span className="lp-pill">🧪 81 tests automatisés</span>
            <span className="lp-pill">📖 Code source ouvert</span>
            <span className="lp-pill">🆓 Gratuit, sans compte</span>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="lp-final">
        <div className="lp-container lp-center">
          <h2 className="lp-h2">Ta soutenance mérite mieux qu&apos;une répétition dans le vide.</h2>
          <p className="lp-lead lp-center">
            Deux minutes suffisent pour ta première séance.
          </p>
          <Link href="/app" className="btn primary big">
            🎤 Commencer maintenant
          </Link>
        </div>
      </section>

      {/* ── pied de page ── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <p>
            Construit par{" "}
            <a href="https://laanibazakaria.github.io" target="_blank" rel="noopener">
              Zakaria Laaniba
            </a>{" "}
            — élève-ingénieur en IA à l&apos;ENSIAS.
          </p>
          <p className="lp-footer-links">
            <a
              href="https://github.com/laanibazakaria/soutenance-coach"
              target="_blank"
              rel="noopener"
            >
              GitHub
            </a>
            <a href="https://www.linkedin.com/in/laaniba-zakaria" target="_blank" rel="noopener">
              LinkedIn
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
