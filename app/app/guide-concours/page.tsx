import Link from "next/link";

export const metadata = {
  title: "Le guide de l'oral de concours",
  description: "Admission en école ou en master, bourse : le déroulé, ce que le jury évalue, se présenter, le projet professionnel, « pourquoi nous », l'actualité du domaine, les erreurs, la veille.",
};

const SECTIONS = [
  { id: "deroule", titre: "Comment ça se passe" },
  { id: "evalue", titre: "Ce que le jury évalue" },
  { id: "presentation", titre: "Se présenter en 3 minutes" },
  { id: "projet", titre: "Le projet professionnel" },
  { id: "pourquoi-nous", titre: "« Pourquoi nous ? » et l'actualité" },
  { id: "erreurs", titre: "Les erreurs classiques" },
  { id: "veille", titre: "La veille et le jour J" },
] as const;

export default function GuideConcoursPage() {
  return (
    <article className="guide">
      <header className="guide-head">
        <nav className="guide-sommaire" aria-label="Sommaire">
          {SECTIONS.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}>
              <span className="guide-num">{i + 1}</span> {s.titre}
            </a>
          ))}
        </nav>
      </header>

      <section id="deroule" className="guide-section">
        <h2>1. Comment ça se passe</h2>
        <p>
          Admission en école d&apos;ingénieurs ou de commerce, en master, bourse d&apos;excellence, concours avec entretien : un oral de
          15 à 30 minutes devant un jury de deux ou trois personnes (enseignants, parfois un professionnel ou un ancien). Formats
          courants — <b>vérifie la convocation</b>, c&apos;est elle qui fait foi :
        </p>
        <div className="guide-grille">
          <div className="card guide-carte"><b>Entretien de motivation</b><p>Présentation de 2 à 5 minutes, puis questions sur le parcours, le projet, la motivation, le domaine.</p></div>
          <div className="card guide-carte"><b>Exposé sur sujet</b><p>Un sujet tiré ou imposé, 10 à 20 minutes de préparation, exposé de 5 à 10 minutes, puis discussion.</p></div>
          <div className="card guide-carte"><b>Oral de dossier</b><p>Le jury a lu ton dossier : il t&apos;interroge dessus — points forts, points faibles, cohérence.</p></div>
        </div>
        <p><b>Le jury a lu ton dossier.</b> Il connaît tes notes, ta lettre, ton CV. L&apos;oral ne sert pas à les répéter : il sert à vérifier que la personne correspond au dossier, et qu&apos;elle sait pourquoi elle est là.</p>
      </section>

      <section id="evalue" className="guide-section">
        <h2>2. Ce que le jury évalue</h2>
        <ol className="guide-liste">
          <li><b>La cohérence.</b> Parcours → ce programme → projet après. Si les trois s&apos;enchaînent, tout le reste suit. C&apos;est le critère numéro un.</li>
          <li><b>La motivation réelle.</b> Des faits précis sur le programme (cours, enseignants, spécialités, partenariats, débouchés), pas « votre école est réputée ».</li>
          <li><b>La culture du domaine.</b> Une actualité, une référence, une question que tu te poses — la preuve que ton intérêt existe hors du dossier.</li>
          <li><b>La maturité.</b> Assumer un point faible du dossier sans t&apos;excuser ; avoir un plan B ; argumenter une opinion quand on te la demande.</li>
          <li><b>La clarté et l&apos;écoute.</b> Réponses structurées, courtes, qui répondent à la question posée.</li>
        </ol>
        <p className="guide-encadre">💡 Un jury d&apos;admission ne cherche pas le meilleur dossier — il l&apos;a déjà classé. Il cherche la personne qui sait ce qu&apos;elle vient faire ici.</p>
      </section>

      <section id="presentation" className="guide-section">
        <h2>3. Se présenter en 3 minutes</h2>
        <ol className="guide-liste">
          <li><b>Qui tu es (30 s)</b> — formation, spécialité, en deux phrases. Pas la chronologie complète.</li>
          <li><b>Ce qui t&apos;a mené ici (60 s)</b> — une ou deux expériences (projet, stage, engagement) avec ce qu&apos;elles t&apos;ont appris, et le moment où ce programme est devenu évident.</li>
          <li><b>Pourquoi ce programme, précisément (45 s)</b> — deux ou trois faits sur le programme reliés à ce que tu cherches.</li>
          <li><b>Ton projet après, et ce que tu apporteras (45 s)</b> — une direction claire, et une chose concrète que tu apportes à la promotion.</li>
        </ol>
        <p>
          Sans réciter ta lettre : le jury l&apos;a lue. <Link href="/app/session?mode=concours&format=3">Entraîne-toi chronométré</Link> — le coach comparera ta présentation à ton dossier.
        </p>
      </section>

      <section id="projet" className="guide-section">
        <h2>4. Le projet professionnel</h2>
        <p>La question qui revient sous dix formes : « Que voulez-vous faire après ? », « Où vous voyez-vous dans dix ans ? », « Pourquoi ce domaine ? ». Ce qu&apos;un bon projet contient :</p>
        <ul className="guide-liste">
          <li><b>Une direction, pas un titre.</b> « Travailler sur la fiabilité des systèmes d&apos;IA en production » vaut mieux que « être data scientist ».</li>
          <li><b>Deux étapes.</b> Ce que tu feras pendant le programme, ce que tu feras juste après. Réalistes.</li>
          <li><b>Le rôle exact du programme.</b> Ce qu&apos;il t&apos;apporte que tu n&apos;as pas — et que tu ne trouverais pas ailleurs aussi bien.</li>
          <li><b>Une part d&apos;incertitude assumée.</b> « Je ne sais pas encore entre recherche et industrie ; ce programme me permet de trancher parce que… » est une réponse mature.</li>
        </ul>
      </section>

      <section id="pourquoi-nous" className="guide-section">
        <h2>5. « Pourquoi nous ? » et l&apos;actualité du domaine</h2>
        <p>Deux questions qui tombent à chaque oral et qui se préparent en une heure — et qui éliminent quand elles ne le sont pas.</p>
        <h3>Trois faits sur le programme</h3>
        <ul className="guide-liste">
          <li>Un cours, un module ou une spécialité précise que tu vises — et pourquoi.</li>
          <li>Un enseignant, un laboratoire, un partenariat, une entreprise liée — et le lien avec ton projet.</li>
          <li>Un débouché réel (statistiques d&apos;insertion, anciens que tu as contactés, un métier précis).</li>
        </ul>
        <h3>Une actualité du domaine</h3>
        <p>Un fait récent et daté — une publication, une décision, un produit, une polémique — avec ce qu&apos;il change et <b>ton avis argumenté</b>. Le jury ne cherche pas le bon avis : il cherche un avis construit.</p>
        <blockquote className="guide-citation">« Le mois dernier, X a publié Y. Ce qui m&apos;a marqué, c&apos;est Z, parce que… Je pense que… »</blockquote>
      </section>

      <section id="erreurs" className="guide-section">
        <h2>6. Les erreurs classiques</h2>
        <ol className="guide-liste guide-erreurs">
          <li><b>Réciter la lettre de motivation.</b> Le jury l&apos;a lue. Il veut la personne derrière.</li>
          <li><b>« Votre école est la meilleure. »</b> Sans fait précis, c&apos;est du vide — et le jury le sait.</li>
          <li><b>Un projet professionnel qui ne passe pas par le programme.</b> Si on peut le faire sans vous, pourquoi vous ?</li>
          <li><b>Ne pas assumer un point faible du dossier.</b> Le jury l&apos;a vu. L&apos;expliquer en deux phrases, sans s&apos;excuser, clôt le sujet. Le nier l&apos;ouvre.</li>
          <li><b>Aucune actualité, aucune référence.</b> Le signe que l&apos;intérêt n&apos;existe que dans le dossier.</li>
          <li><b>Pas de plan B.</b> « Si vous n&apos;êtes pas pris ? » — « Je ne sais pas » inquiète. Un plan B qui garde la direction rassure.</li>
          <li><b>Répondre à côté, ou trop long.</b> Reformule, réponds en trois phrases, arrête-toi.</li>
          <li><b>Vouloir plaire à tout prix.</b> Une opinion nuancée et argumentée vaut mieux que l&apos;accord systématique avec le jury.</li>
        </ol>
      </section>

      <section id="veille" className="guide-section">
        <h2>7. La veille et le jour J</h2>
        <ul className="guide-check">
          <li>Trois faits sur le programme et une actualité du domaine, relus</li>
          <li>Présentation de 3 minutes dite une fois à voix haute ; projet professionnel en trois phrases</li>
          <li>Le dossier relu : pour chaque point faible, deux phrases prêtes</li>
          <li>Convocation, pièce d&apos;identité, dossier imprimé, trajet vérifié (arriver 20 minutes en avance)</li>
          <li>Tenue sobre ; en visio : caméra, micro, fond, connexion testés</li>
          <li>Le jour J : salue, écoute jusqu&apos;au bout, reformule, réponds court, remercie</li>
        </ul>
      </section>

      <footer className="guide-pied">
        <p>
          Prêt ? <Link href="/app/m/concours">Ton oral</Link> te dit ce qu&apos;il reste à faire.
        </p>
      </footer>
    </article>
  );
}
