import Link from "next/link";
import Image from "next/image";
import accueil from "@/docs/accueil.png";
import session from "@/docs/session.png";
import { Icone, IconeBadge, type NomIcone } from "@/app/components/Icone";

/**
 * Les trois membres du jury de soutenance, tels qu'ils existent dans
 * lib/appel/index.ts. Chacun a sa voix et son obsession : c'est ce qui fait
 * qu'ils ne posent pas la même question.
 */
const JURY: ReadonlyArray<{ icone: NomIcone; titre: string; texte: string }> = [
  {
    icone: "memoire",
    titre: "Le rapporteur",
    texte:
      "Il a lu ton mémoire ligne à ligne. Il cite tes passages, relève les incohérences, et te demande d'où sort ce chiffre page 34.",
  },
  {
    icone: "soutenance",
    titre: "La présidente du jury",
    texte:
      "Elle cadre la séance et pose les questions larges : ce que tu as vraiment apporté, la portée du travail, le temps qui passe.",
  },
  {
    icone: "message",
    titre: "L'encadrant",
    texte:
      "Plutôt bienveillant : il te tend des perches sur ce que tu as fait toi-même et sur tes difficultés. Mais il n'accepte pas le flou.",
  },
];

const OUTILS: ReadonlyArray<{ icone: NomIcone; titre: string; texte: string }> = [
  { icone: "calendrier", titre: "Le parcours J-X", texte: "Ta date, ton format, et chaque jour ce qu'il faut faire : les étapes prouvées par ton activité se cochent seules." },
  { icone: "slides", titre: "Répéter avec tes slides", texte: "La diapositive à l'écran, un chrono par diapositive comparé au minutage de ton pitch. Tu sauras laquelle mange le temps." },
  { icone: "fiches", titre: "Les fiches à mémoriser", texte: "Chiffres, définitions, choix à justifier, questions pièges — tirés de tes slides, révisés avec rappel espacé." },
  { icone: "parole", titre: "Répéter avec un ami", texte: "Un lien : il joue le jury sans avoir à créer de compte, avec les bonnes questions sous les yeux. Son retour revient dans ta préparation." },
  { icone: "entretien", titre: "L'entretien d'embauche", texte: "Ton CV et l'offre : le même appel, mais avec une chargée de recrutement et ton futur responsable technique." },
  { icone: "pitch", titre: "Le pitch de projet", texte: "Concours d'innovation, startup, hackathon : un investisseur sceptique, une experte technique, un professionnel du secteur." },
  { icone: "concours", titre: "L'oral de concours", texte: "Admission en école ou en master, bourse : un jury d'admission, le « pourquoi nous », le projet professionnel." },
  { icone: "livre", titre: "Les guides", texte: "Un guide par oral : comment ça se passe, ce que le jury note vraiment, et comment répondre à une question dont tu n'as pas la réponse." },
];

const METRIQUES: ReadonlyArray<{ icone: NomIcone; titre: string; texte: string }> = [
  {
    icone: "chrono",
    titre: "Tenue du temps",
    texte:
      "Format PFA 15 min ou PFE 20 min : le minuteur passe à l'orange dans les dernières minutes, au rouge au dépassement. Un jury coupe — coupe avant lui.",
  },
  {
    icone: "parole",
    titre: "Débit de parole",
    texte:
      "Mots par minute, comparés à la zone confortable d'un exposé (110-160). Trop lent, le jury décroche ; trop rapide, il ne suit plus.",
  },
  {
    icone: "cible",
    titre: "Mots béquilles",
    texte:
      "« euh », « du coup », « en fait », « voilà »… comptés pour 100 mots, avec le détail de ceux qui reviennent le plus. Ceux qu'on n'entend jamais soi-même.",
  },
  {
    icone: "boussole",
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
                  stroke="#0f766e"
                  strokeWidth="7"
                />
                <circle r="8" fill="#f59e0b" />
              </g>
            </svg>
            SoutenanceCoach
          </span>
          <div className="lp-nav-links">
            <a href="#appel">L&apos;appel</a>
            <a href="#grille">La grille</a>
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

      {/* ── hero : l'appel, pas la mesure ── */}
      <header className="lp-hero">
        <div className="lp-container">
          <span className="lp-badge">Gratuit · Open source</span>
          <h1 className="lp-title">
            Un jury qui a lu ton mémoire
            <br />
            <span className="lp-title-accent">et qui t&apos;appelle pour en parler.</span>
          </h1>
          <p className="lp-lead">
            Tu déposes tes diapositives et ton mémoire. Trois membres du jury les lisent en entier,
            ligne à ligne. Puis ils t&apos;appellent : ils parlent, tu réponds au micro, ils
            rebondissent sur ce que tu viens de dire. À la fin, le débrief — et une note calculée sur
            douze critères, jamais improvisée.
          </p>
          <div className="lp-cta">
            <Link href="/app" className="btn primary big">
              <Icone nom="appel" /> Passer mon premier appel
            </Link>
            <a href="#appel" className="btn big">
              Voir comment ça se passe
            </a>
          </div>
          <p className="lp-hint">
            Fonctionne sur Chrome et Edge · Rien à installer · Ton audio reste sur ton appareil
          </p>

          {/* Une illustration de l'échange, pas une capture : les répliques
              montrent d'où vient une question — du document, pas du vide. */}
          <div className="lp-echange" aria-label="Exemple d'échange avec le jury">
            <div className="lp-tour lp-tour-jury">
              <span className="lp-tour-qui">Le rapporteur</span>
              <p>
                Page 34, vous annoncez un F1 de 0,91. Sur quel jeu de test, et combien de sessions
                d&apos;anomalies contenait-il ?
              </p>
            </div>
            <div className="lp-tour lp-tour-toi">
              <span className="lp-tour-qui">Toi</span>
              <p>Sur le jeu de test, euh… je crois 240 000 sessions au total.</p>
            </div>
            <div className="lp-tour lp-tour-jury">
              <span className="lp-tour-qui">Le rapporteur</span>
              <p>
                240 000, c&apos;est votre jeu d&apos;entraînement — vous l&apos;écrivez page 12. Ma
                question portait sur le test.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── le problème ── */}
      <section className="lp-section lp-problem">
        <div className="lp-container lp-narrow">
          <h2 className="lp-h2">Personne autour de toi n&apos;a lu ton mémoire</h2>
          <p className="lp-p">
            Tu répètes devant ton miroir, ou devant un ami qui te dit « c&apos;était bien ». Mais ton
            ami ne peut pas te demander d&apos;où sort le chiffre de la page 34, ni te faire
            remarquer que ta conclusion contredit ta section 3.{" "}
            <b>Ces questions-là, seul quelqu&apos;un qui a lu ton document peut les poser</b> — et le
            jour de la soutenance, c&apos;est exactement ce qui t&apos;attend.
          </p>
          <p className="lp-p">
            C&apos;est ce que fait cette application : elle lit ton dossier en entier, puis elle
            t&apos;interroge dessus. Et elle t&apos;accompagne jusqu&apos;au jour J — un plan jour par
            jour, tes slides, tes fiches, tes mesures.
          </p>
        </div>
      </section>

      {/* ── comment se passe l'appel ── */}
      <section className="lp-section" id="appel">
        <div className="lp-container">
          <h2 className="lp-h2 lp-center">Quatre temps, un quart d&apos;heure</h2>
          <p className="lp-sub lp-center">
            L&apos;appel dure 5, 10 ou 15 minutes, en français ou en anglais.
          </p>
          <div className="lp-steps">
            <article>
              <span className="lp-step-num">1</span>
              <h3>Tu déposes ton dossier</h3>
              <p>
                Tes diapositives et ton mémoire, en PDF ou en PowerPoint. Ils sont lus dans ton
                navigateur : seul le texte est conservé, jamais le fichier.
              </p>
            </article>
            <article>
              <span className="lp-step-num">2</span>
              <h3>Le jury lit tout</h3>
              <p>
                Pas un résumé : le document entier, découpé en passes successives, jusqu&apos;à
                environ 270 pages. Il te dit combien il a lu, et le reconnaît s&apos;il n&apos;a pas
                tout eu.
              </p>
            </article>
            <article>
              <span className="lp-step-num">3</span>
              <h3>Il t&apos;appelle</h3>
              <p>
                Trois membres, trois voix distinctes. Tu réponds au micro ; quand tu te tais deux
                secondes, le suivant enchaîne — et rebondit sur ce que tu viens de dire.
              </p>
            </article>
            <article>
              <span className="lp-step-num">4</span>
              <h3>Tu lis le débrief</h3>
              <p>
                Ce qui a marché, les moments manqués, le plan d&apos;action. Et la grille : douze
                critères notés, pondérés, avec la note qui en découle.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── qui est en face ── */}
      <section className="lp-section lp-alt">
        <div className="lp-container">
          <h2 className="lp-h2 lp-center">Trois personnes, trois obsessions</h2>
          <p className="lp-sub lp-center">
            Un jury n&apos;est pas une voix unique. Chacun cherche autre chose — et c&apos;est
            précisément ce qui rend l&apos;exercice difficile.
          </p>
          <div className="lp-grid">
            {JURY.map((j) => (
              <article key={j.titre} className="lp-card">
                <span className="lp-card-icon" aria-hidden="true">
                  <IconeBadge nom={j.icone} taille={44} />
                </span>
                <h3>{j.titre}</h3>
                <p>{j.texte}</p>
              </article>
            ))}
          </div>
          <p className="lp-sub lp-center">
            Pour l&apos;entretien d&apos;embauche, le pitch et l&apos;oral de concours, le jury change
            de composition — mais le principe reste le même.
          </p>
        </div>
      </section>

      {/* ── la grille ── */}
      <section className="lp-section" id="grille">
        <div className="lp-container lp-split">
          <div>
            <span className="lp-eyebrow">Après l&apos;appel</span>
            <h2 className="lp-h2">Une note que personne n&apos;a improvisée</h2>
            <p className="lp-p">
              Douze critères, chacun avec son poids : la problématique et la méthode comptent double,
              la posture compte simple. <b>L&apos;IA juge chaque critère séparément</b> et dit
              pourquoi, en citant ce que tu as répondu.
            </p>
            <p className="lp-p">
              <b>La note, c&apos;est le code qui la calcule</b> — la moyenne pondérée des critères
              évalués. Et si le jury n&apos;a pas eu de quoi juger assez de critères, il n&apos;y a
              pas de note du tout, plutôt qu&apos;un chiffre posé sur du vide.
            </p>
            <p className="lp-quote">
              « Résultats chiffrés : 6/10 — les chiffres sont là, mais sans point de comparaison. »
            </p>
          </div>
          <div className="lp-grille-demo">
            <div className="lp-grille-ligne">
              <b>Problématique explicite</b>
              <span className="lp-grille-poids">×2</span>
              <span className="lp-grille-note lp-note-bien">8/10</span>
            </div>
            <div className="lp-grille-ligne">
              <b>Méthode justifiée</b>
              <span className="lp-grille-poids">×2</span>
              <span className="lp-grille-note lp-note-moyen">6/10</span>
            </div>
            <div className="lp-grille-ligne">
              <b>Résultats chiffrés</b>
              <span className="lp-grille-poids">×2</span>
              <span className="lp-grille-note lp-note-moyen">6/10</span>
            </div>
            <div className="lp-grille-ligne">
              <b>Maîtrise de ses chiffres</b>
              <span className="lp-grille-poids">×1,5</span>
              <span className="lp-grille-note lp-note-faible">4/10</span>
            </div>
            <div className="lp-grille-ligne">
              <b>Posture et regard</b>
              <span className="lp-grille-poids">×1</span>
              <span className="lp-grille-note lp-note-vide">non évalué</span>
            </div>
            <div className="lp-grille-total">
              <b>Note calculée</b>
              <span>6,1 / 10</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── mesures ── */}
      <section className="lp-section lp-alt" id="mesures">
        <div className="lp-container">
          <h2 className="lp-h2 lp-center">Et quand tu répètes seul</h2>
          <p className="lp-sub lp-center">
            Entre deux appels, tu t&apos;enregistres. Quatre indicateurs qu&apos;un jury remarque — et
            que tu ne perçois pas toi-même.
          </p>
          <div className="lp-grid">
            {METRIQUES.map((m) => (
              <article key={m.titre} className="lp-card">
                <span className="lp-card-icon" aria-hidden="true">
                  <IconeBadge nom={m.icone} teinte="or" taille={44} />
                </span>
                <h3>{m.titre}</h3>
                <p>{m.texte}</p>
              </article>
            ))}
          </div>
          <div className="lp-shot lp-shot-narrow">
            <Image src={session} alt="L'écran de session avec les formats PFA et PFE" />
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
              Un appel isolé ne dit rien. Ce qui compte, c&apos;est la tendance : est-ce que tes
              béquilles diminuent ? est-ce que tu bloques toujours sur le même critère ? est-ce que
              ta méthode tient mieux qu&apos;il y a une semaine ?
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
              <span className="lp-trend-icon"><Icone nom="cadenas" taille={16} /></span>
              <div>
                <b>Tenue du temps</b>
                <span>Encore 2 séances pour débloquer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── le reste de la plateforme ── */}
      <section className="lp-section lp-alt" id="outils">
        <div className="lp-container">
          <h2 className="lp-h2 lp-center">Tout ce qu&apos;il y a autour</h2>
          <p className="lp-sub lp-center">
            Donne ta date de soutenance : le parcours répartit les étapes sur les jours qui restent et
            coche tout seul celles que ton activité prouve.
          </p>
          <div className="lp-grid">
            {OUTILS.map((o) => (
              <article key={o.titre} className="lp-card">
                <span className="lp-card-icon" aria-hidden="true">
                  <IconeBadge nom={o.icone} taille={44} />
                </span>
                <h3>{o.titre}</h3>
                <p>{o.texte}</p>
              </article>
            ))}
          </div>
          <div className="lp-shot lp-shot-narrow">
            <Image src={accueil} alt="L'écran d'accueil de SoutenanceCoach" />
          </div>
        </div>
      </section>

      {/* ── philosophie ── */}
      <section className="lp-section">
        <div className="lp-container lp-narrow">
          <span className="lp-eyebrow">Ce qui rend cet outil différent</span>
          <h2 className="lp-h2">Aucun chiffre n&apos;est inventé par une IA</h2>
          <p className="lp-p">
            Un modèle de langage se trompe de manière <i>plausible</i> : une note fausse ressemble à
            une note juste, et rien ne la distingue. Ici, <b>chaque mesure est calculée par du code
            déterministe et testé</b> — plus de 350 tests automatisés le vérifient à chaque
            modification. L&apos;IA, elle, juge chaque critère et rédige : les questions du jury, le
            débrief, un pitch, des fiches. La note, c&apos;est le code qui la calcule à partir de ces
            critères et de leurs poids — jamais le modèle.
          </p>
          <p className="lp-p">
            Et quand les données ne suffisent pas, l&apos;application <b>s&apos;abstient</b> : elle
            affiche « non mesuré » et explique pourquoi, plutôt que de produire un verdict sur du
            bruit. Une transcription hachée ne prouve pas des phrases courtes ; un micro qui a mal
            capté ne prouve pas que tu parles lentement.
          </p>
          <div className="lp-pills">
            <span className="lp-pill"><Icone nom="cadenas" /> Audio et fichiers jamais envoyés</span>
            <span className="lp-pill"><Icone nom="flacon" /> 369 tests automatisés</span>
            <span className="lp-pill"><Icone nom="livre" /> Code source ouvert</span>
            <span className="lp-pill"><Icone nom="valide" taille={16} /> Gratuit</span>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="lp-final">
        <div className="lp-container lp-center">
          <h2 className="lp-h2">
            Le jour J, quelqu&apos;un aura lu ton mémoire. Autant que ce ne soit pas la première fois.
          </h2>
          <p className="lp-lead lp-center">
            Dépose ton dossier, et passe ton premier appel dans le quart d&apos;heure.
          </p>
          <Link href="/app" className="btn primary big">
            <Icone nom="appel" /> Commencer maintenant
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
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
