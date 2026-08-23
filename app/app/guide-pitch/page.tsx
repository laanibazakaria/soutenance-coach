import Link from "next/link";
import { Icone } from "@/app/components/Icone";

export const metadata = {
  title: "Le guide du pitch de projet",
  description: "Structure d'un pitch en 3 minutes, la preuve avant la promesse, les questions d'un jury d'innovation, les erreurs qui coûtent le prix, la demande finale.",
};

const SECTIONS = [
  { id: "jury", titre: "Ce que cherche un jury d'innovation" },
  { id: "structure", titre: "La structure en 3 minutes" },
  { id: "preuve", titre: "La preuve avant la promesse" },
  { id: "questions", titre: "Les questions, et la bonne attitude" },
  { id: "erreurs", titre: "Les erreurs qui coûtent le prix" },
  { id: "demo", titre: "Slides et démo" },
  { id: "veille", titre: "La veille et le jour J" },
] as const;

export default function GuidePitchPage() {
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

      <section id="jury" className="guide-section">
        <h2>1. Ce que cherche un jury d&apos;innovation</h2>
        <p>
          Concours d&apos;école, incubateur, hackathon, comité de financement : les formats changent, le regard est le même. Un jury
          voit dix projets dans la journée ; il retient celui dont il peut répéter <b>le problème en une phrase</b>, qui a montré{" "}
          <b>une preuve</b> plutôt qu&apos;une promesse, et dont l&apos;équipe a répondu <b>directement</b> aux questions.
        </p>
        <ol className="guide-liste">
          <li><b>Le problème est-il réel et précis ?</b> Pour qui, combien ça leur coûte aujourd&apos;hui, comment ils se débrouillent sans vous.</li>
          <li><b>Qu&apos;est-ce qui existe déjà ?</b> Prototype, utilisateurs, chiffres, retours. Une idée ne se juge pas ; une traction, si.</li>
          <li><b>Pourquoi vous, pourquoi maintenant ?</b> Ce que vous savez que les autres ignorent, et ce qui a changé qui rend le projet possible.</li>
          <li><b>Est-ce réaliste ?</b> Le plan des six prochains mois, chiffré, et la lucidité sur les risques.</li>
          <li><b>A-t-on envie de vous aider ?</b> Franchise, énergie, écoute — et une demande claire.</li>
        </ol>
      </section>

      <section id="structure" className="guide-section">
        <h2>2. La structure en 3 minutes</h2>
        <p>Une idée par bloc, une phrase d&apos;accroche au début, une demande à la fin. Le tout tient en 3 minutes — répète-le chronométré.</p>
        <div className="guide-grille">
          <div className="card guide-carte"><b>0. L&apos;accroche (15 s)</b><p>Une situation concrète, un chiffre qui surprend, ou la phrase que dirait votre utilisateur. Apprise par cœur.</p></div>
          <div className="card guide-carte"><b>1. Le problème (30 s)</b><p>Qui, quoi, combien ça coûte. Un exemple vécu vaut mieux qu&apos;un marché en milliards.</p></div>
          <div className="card guide-carte"><b>2. La solution (30 s)</b><p>Ce que vous faites, en une phrase, puis comment ça marche pour l&apos;utilisateur. Pas la technologie d&apos;abord.</p></div>
          <div className="card guide-carte"><b>3. La preuve (40 s)</b><p>Ce qui existe : prototype, utilisateurs, tests, retours, revenus. Les chiffres réels, même petits.</p></div>
          <div className="card guide-carte"><b>4. Marché et différence (30 s)</b><p>Qui paie, les alternatives (y compris « ne rien faire »), et votre différence concrète.</p></div>
          <div className="card guide-carte"><b>5. Équipe et demande (25 s)</b><p>Pourquoi vous, ce qui manque, et ce que vous demandez — une phrase, précise. Apprise par cœur.</p></div>
        </div>
        <p>
          <Link href="/app/session?mode=pitch&format=3">Entraîne-toi chronométré</Link> : le coach comparera ensuite ce que tu as dit à ton dossier.
        </p>
      </section>

      <section id="preuve" className="guide-section">
        <h2>3. La preuve avant la promesse</h2>
        <p>
          La différence entre un pitch d&apos;étudiant et un pitch qui gagne : <b>le second montre ce qui existe</b>. Dans l&apos;ordre de force :
        </p>
        <ol className="guide-liste">
          <li>Des revenus, même symboliques — quelqu&apos;un a payé.</li>
          <li>Des utilisateurs qui reviennent — avec le chiffre de rétention.</li>
          <li>Des utilisateurs qui ont essayé — et ce qu&apos;ils ont dit, verbatim.</li>
          <li>Un prototype qui fonctionne — montré, pas décrit.</li>
          <li>Des entretiens avec la cible — combien, et ce qui vous a surpris.</li>
        </ol>
        <p className="guide-encadre"><Icone nom="idee" /> Un petit chiffre vrai (« 12 utilisateurs, 7 reviennent chaque semaine ») bat un grand chiffre projeté (« un marché de 2 milliards »). Le jury sait d&apos;où vient chacun.</p>
      </section>

      <section id="questions" className="guide-section">
        <h2>4. Les questions, et la bonne attitude</h2>
        <p>Les questions d&apos;un jury d&apos;innovation sont prévisibles : problème, preuve, concurrence, modèle, risques, équipe, demande. <Link href="/app/m/pitch#questions">Les tiennes sont là</Link>. Ce qui compte, c&apos;est la manière :</p>
        <ul className="guide-liste">
          <li><b>Réponds directement.</b> « Non, pas encore » est une réponse. Un détour de deux minutes pour ne pas dire non, c&apos;est ce que le jury retient.</li>
          <li><b>Un chiffre, puis le contexte.</b> Pas l&apos;inverse.</li>
          <li><b>« Nous n&apos;avons pas de concurrent »</b> est éliminatoire. Il y a toujours l&apos;alternative actuelle, même si c&apos;est un tableur ou « ne rien faire ».</li>
          <li><b>Le risque, tu le nommes toi-même.</b> Un jury qui le découvre seul doute de tout le reste.</li>
          <li><b>La critique juste :</b> « C&apos;est exact. Voici ce qu&apos;on fait pour… » — puis tais-toi.</li>
          <li><b>Une seule personne répond</b> à chaque question. L&apos;équipe qui se coupe la parole perd des points à chaque phrase.</li>
        </ul>
      </section>

      <section id="erreurs" className="guide-section">
        <h2>5. Les erreurs qui coûtent le prix</h2>
        <ol className="guide-liste guide-erreurs">
          <li><b>Commencer par la technologie.</b> Le jury veut le problème et pour qui. La stack vient en question, si on te la pose.</li>
          <li><b>Le marché en milliards.</b> Tout le monde l&apos;a vu cent fois. Ton premier segment précis, lui, est crédible.</li>
          <li><b>Aucune preuve.</b> Un projet sans prototype ni utilisateur est une idée. Même dix entretiens changent tout.</li>
          <li><b>Dépasser le temps.</b> Un jury qui te coupe ne pose pas sa question — et retient qu&apos;il t&apos;a coupé.</li>
          <li><b>Pas de demande.</b> Un pitch sans « voici ce que nous demandons » est une présentation. Le jury ne sait pas quoi faire de toi.</li>
          <li><b>Lire ses slides.</b> Une idée par slide, un chiffre ou une image — et ton regard sur le jury.</li>
          <li><b>Une démo non testée.</b> Si tu montres un écran, il doit marcher hors ligne, sur ta machine, avec un plan B en captures.</li>
          <li><b>Enrober un « non ».</b> « Ce n&apos;est pas encore fait » dit une fois vaut mieux que deux minutes de conditionnel.</li>
        </ol>
      </section>

      <section id="demo" className="guide-section">
        <h2>6. Slides et démo</h2>
        <ul className="guide-liste">
          <li><b>Une idée par slide</b>, un titre qui est la phrase à retenir, un chiffre ou une image. Pas de paragraphe.</li>
          <li><b>Lisible du fond de la salle</b> : si le jury doit plisser les yeux, la slide n&apos;existe pas.</li>
          <li><b>La démo</b> : trente secondes, un parcours utilisateur, testée le matin même, hors ligne. Captures d&apos;écran en secours dans les slides.</li>
          <li><b>La dernière slide reste affichée</b> pendant les questions : le nom du projet, la phrase d&apos;accroche, la demande, un contact.</li>
        </ul>
      </section>

      <section id="veille" className="guide-section">
        <h2>7. La veille et le jour J</h2>
        <ul className="guide-check">
          <li>Pitch dit une fois chronométré — accroche et demande par cœur</li>
          <li>Démo testée hors ligne, captures de secours dans les slides, slides sur clé USB et en ligne</li>
          <li>Les questions de ton dossier relues, une réponse en trois phrases prête pour chacune</li>
          <li>Qui répond à quoi dans l&apos;équipe, décidé à l&apos;avance</li>
          <li>Arriver 20 minutes en avance, tester l&apos;affichage ; eau ; regard sur le jury, pas sur l&apos;écran</li>
          <li>Après : noter chaque question posée — elles reviendront au prochain jury</li>
        </ul>
      </section>

      <footer className="guide-pied">
        <p>
          Prêt ? <Link href="/app/m/pitch">Ton pitch</Link> te dit ce qu&apos;il reste à faire.
        </p>
      </footer>
    </article>
  );
}
