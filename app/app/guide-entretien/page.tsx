import Link from "next/link";
import { Icone } from "@/app/components/Icone";

export const metadata = {
  title: "Le guide de l'entretien d'embauche",
  description: "Comment se passe un entretien, ce que le recruteur évalue, « présentez-vous » en 2 minutes, la méthode STAR, les erreurs qui éliminent, les questions à poser, le salaire, l'après.",
};

const SECTIONS = [
  { id: "deroule", titre: "Comment ça se passe" },
  { id: "evalue", titre: "Ce que le recruteur évalue" },
  { id: "presentez-vous", titre: "« Présentez-vous » en 2 minutes" },
  { id: "star", titre: "La méthode STAR" },
  { id: "erreurs", titre: "Les erreurs qui éliminent" },
  { id: "questions-a-poser", titre: "Tes questions pour eux" },
  { id: "salaire", titre: "Le salaire" },
  { id: "veille", titre: "La veille et le jour J" },
  { id: "apres", titre: "Après l'entretien" },
] as const;

export default function GuideEntretienPage() {
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
          Un recrutement, c&apos;est rarement un seul entretien. Le schéma le plus courant pour un jeune diplômé :
        </p>
        <div className="guide-grille">
          <div className="card guide-carte">
            <b>Entretien RH</b>
            <p>30 à 45 minutes. Parcours, motivation, adéquation, disponibilité, prétentions. Souvent en visio, parfois par téléphone d&apos;abord (15 min).</p>
          </div>
          <div className="card guide-carte">
            <b>Entretien technique</b>
            <p>45 à 90 minutes avec le futur manager ou un senior. Projets en profondeur, cas pratique ou exercice, parfois un test à la maison avant.</p>
          </div>
          <div className="card guide-carte">
            <b>Dernier tour</b>
            <p>Un directeur, ou l&apos;équipe. Moins de questions, plus de discussion : est-ce qu&apos;on a envie de travailler ensemble.</p>
          </div>
        </div>
        <p>
          <b>Chaque tour a un objectif différent.</b> Le RH vérifie que tu corresponds et que tu es fiable ; le technique vérifie que tu sais
          faire ce que ton CV dit ; le dernier vérifie que tu t&apos;intégreras. Prépare chacun pour ce qu&apos;il est.
        </p>
      </section>

      <section id="evalue" className="guide-section">
        <h2>2. Ce que le recruteur évalue</h2>
        <ol className="guide-liste">
          <li><b>Est-ce que tu sais faire ce que tu dis ?</b> Le CV affirme ; l&apos;entretien vérifie. Chaque ligne de ton CV est une question possible — sois capable de raconter chacune avec des faits.</li>
          <li><b>Est-ce que tu as choisi ce poste ?</b> Deux faits précis sur l&apos;entreprise et une raison honnête valent mieux que cent candidatures copiées-collées.</li>
          <li><b>Est-ce que tu es fiable ?</b> Ponctualité, clarté des réponses, cohérence entre ce que tu dis et le CV, disponibilité claire.</li>
          <li><b>Comment tu réagis quand ça frotte ?</b> Les questions sur l&apos;échec, le conflit, la pression ne cherchent pas la perfection : elles cherchent le recul.</li>
          <li><b>Est-ce qu&apos;on a envie de travailler avec toi ?</b> Écoute, concision, curiosité, pas d&apos;arrogance. Ça se joue dans la manière, pas dans le contenu.</li>
        </ol>
        <p className="guide-encadre"><Icone nom="idee" /> Un recruteur n&apos;attend pas un candidat parfait. Il attend quelqu&apos;un de clair, honnête et préparé. Les trois se travaillent.</p>
      </section>

      <section id="presentez-vous" className="guide-section">
        <h2>3. « Présentez-vous » en 2 minutes</h2>
        <p>La première question de presque tous les entretiens — et la plus mal préparée. Structure en trois temps :</p>
        <ol className="guide-liste">
          <li><b>Présent (20 s)</b> — qui tu es en une phrase : formation, spécialité, ce que tu sais faire. « Je suis ingénieur en IA, diplômé de l&apos;ENSIAS, spécialisé dans la mise en production de modèles. »</li>
          <li><b>Passé (60 s)</b> — deux expériences qui le prouvent, avec un résultat chaque fois. Pas ta vie : ce qui sert ce poste.</li>
          <li><b>Futur (30 s)</b> — pourquoi ce poste maintenant, en reliant à ce qu&apos;ils cherchent. Termine sur une phrase qui ouvre : « C&apos;est pour ça que votre offre m&apos;a intéressé. »</li>
        </ol>
        <p>
          Deux minutes, pas plus : le recruteur a ton CV sous les yeux. <Link href="/app/session?mode=entretien&format=2">Entraîne-toi chronométré</Link> — le coach comparera ton pitch à ton CV et à l&apos;offre.
        </p>
      </section>

      <section id="star" className="guide-section">
        <h2>4. La méthode STAR</h2>
        <p>Pour toute question qui commence par « racontez-moi une fois où… » : quatre temps, trente à soixante secondes.</p>
        <div className="guide-grille">
          <div className="card guide-carte"><b>S — Situation</b><p>Le contexte en une phrase. Où, quand, avec qui.</p></div>
          <div className="card guide-carte"><b>T — Tâche</b><p>Ce que tu devais faire, toi. Ton rôle, pas celui de l&apos;équipe.</p></div>
          <div className="card guide-carte"><b>A — Action</b><p>Ce que tu as fait concrètement, et pourquoi ce choix. La partie la plus longue.</p></div>
          <div className="card guide-carte"><b>R — Résultat</b><p>Ce que ça a donné, chiffré si possible. Et ce que tu en as appris.</p></div>
        </div>
        <blockquote className="guide-citation">
          « Pendant mon stage, l&apos;application perdait des enregistrements (S). J&apos;étais chargé de trouver pourquoi (T). J&apos;ai reproduit le bug, isolé la cause dans la gestion du réseau, et ajouté un test de non-régression (A). Plus aucune perte en deux mois, et le test a attrapé une régression depuis (R). »
        </blockquote>
      </section>

      <section id="erreurs" className="guide-section">
        <h2>5. Les erreurs qui éliminent</h2>
        <ol className="guide-liste guide-erreurs">
          <li><b>Ne rien savoir sur l&apos;entreprise.</b> Dix minutes sur leur site et leur LinkedIn suffisent. Ne pas les avoir prises dit tout.</li>
          <li><b>Réciter son CV.</b> Le recruteur l&apos;a lu. Raconte ce qu&apos;il ne dit pas : pourquoi, comment, ce que ça a donné.</li>
          <li><b>Le faux défaut.</b> « Je suis trop perfectionniste » : tout le monde l&apos;a entendu cent fois. Un vrai point faible, en cours de travail, inspire confiance.</li>
          <li><b>Dire du mal d&apos;un ancien employeur, d&apos;un prof, d&apos;une équipe.</b> Jamais. Même si c&apos;est vrai.</li>
          <li><b>Répondre à côté, ou trop long.</b> Reformule la question, réponds en trois phrases avec un exemple, arrête-toi.</li>
          <li><b>Mentir sur une compétence.</b> Le technique le verra en deux questions. « Je l&apos;ai vu en cours, pas en projet » est une réponse parfaitement acceptable.</li>
          <li><b>« Avez-vous des questions ? » — « Non. »</b> C&apos;est lu comme un manque d&apos;intérêt. Prépare-en trois.</li>
          <li><b>Parler salaire en premier.</b> Attends qu&apos;on te le demande — et aie ta fourchette prête.</li>
          <li><b>Arriver en retard, ou en visio avec un fond de chambre et un micro qui grésille.</b> Teste tout la veille.</li>
          <li><b>Ne pas remercier après.</b> Un mail de trois lignes dans les 24 h : rare, donc remarqué.</li>
        </ol>
      </section>

      <section id="questions-a-poser" className="guide-section">
        <h2>6. Tes questions pour eux</h2>
        <p>Trois questions préparées, qui montrent que tu te projettes. Choisis parmi :</p>
        <ul className="guide-liste">
          <li>« À quoi ressemblent les trois premiers mois sur ce poste ? »</li>
          <li>« Comment l&apos;équipe est-elle organisée, et avec qui vais-je travailler au quotidien ? »</li>
          <li>« Quel est le plus gros défi de l&apos;équipe en ce moment ? »</li>
          <li>« Comment se passe l&apos;accompagnement d&apos;un junior ici — mentorat, revue, formation ? »</li>
          <li>« Qu&apos;est-ce qui fait qu&apos;une personne réussit vraiment dans ce poste, selon vous ? »</li>
          <li>« Quelles sont les prochaines étapes du processus ? »</li>
        </ul>
        <p>À éviter au premier tour : les congés, le télétravail en premier, les avantages. Ça viendra.</p>
      </section>

      <section id="salaire" className="guide-section">
        <h2>7. Le salaire</h2>
        <ul className="guide-liste">
          <li><b>Renseigne-toi avant</b> : offres similaires, anciens de ton école, grilles connues pour ton niveau et ta ville. Tu dois arriver avec une fourchette, pas un chiffre sorti de nulle part.</li>
          <li><b>Donne une fourchette, calmement.</b> « D&apos;après ce que je vois sur le marché pour ce poste, entre X et Y, selon le périmètre. » Puis silence.</li>
          <li><b>Si on te demande en premier ton salaire actuel ou attendu</b>, tu peux retourner la question : « Quelle est la fourchette prévue pour ce poste ? »</li>
          <li><b>Ne négocie qu&apos;avec une offre écrite.</b> Et négocie le global : formation, télétravail, date de revue, pas seulement le fixe.</li>
        </ul>
      </section>

      <section id="veille" className="guide-section">
        <h2>8. La veille et le jour J</h2>
        <ul className="guide-check">
          <li>Deux faits sur l&apos;entreprise, un sur l&apos;équipe ou le produit, relus</li>
          <li>Ton pitch de 2 minutes dit une fois à voix haute, et tes trois questions</li>
          <li>Chaque ligne de ton CV : une histoire STAR prête</li>
          <li>Trajet vérifié (arrive 10 minutes en avance) — ou visio testée : caméra, micro, fond, connexion</li>
          <li>CV imprimé en deux exemplaires, carnet, stylo, eau</li>
          <li>Tenue : un cran au-dessus de ce que porte l&apos;équipe</li>
          <li>Le jour J : écoute jusqu&apos;au bout, reformule, réponds en trois phrases, arrête-toi</li>
        </ul>
      </section>

      <section id="apres" className="guide-section">
        <h2>9. Après l&apos;entretien</h2>
        <dl className="guide-faq">
          <dt>Le mail de remerciement</dt>
          <dd>Dans les 24 h, trois lignes : merci pour l&apos;échange, un point précis qui t&apos;a marqué, ta motivation confirmée. Rare, donc remarqué.</dd>
          <dt>Pas de réponse après le délai annoncé</dt>
          <dd>Une relance polie, une seule, deux ou trois jours après la date donnée. Puis passe à la suite : un silence est une réponse.</dd>
          <dt>Un refus</dt>
          <dd>Demande un retour en une phrase — certains répondent, et c&apos;est de l&apos;or. Note ce que tu changerais, et refais une simulation ici avec cette question.</dd>
          <dt>Une offre</dt>
          <dd>Demande-la par écrit, prends 24 à 48 h pour la lire, et négocie une fois, proprement. Accepter trop vite ou faire traîner sont les deux erreurs.</dd>
        </dl>
      </section>

      <footer className="guide-pied">
        <p>
          Prêt ? <Link href="/app/entretien">Ton profil d&apos;entretien</Link> te dit ce qu&apos;il reste à faire.
        </p>
      </footer>
    </article>
  );
}
