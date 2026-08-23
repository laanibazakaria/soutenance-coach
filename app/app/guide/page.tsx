import Link from "next/link";
import { Icone } from "@/app/components/Icone";

export const metadata = {
  title: "Le guide de la soutenance — SoutenanceCoach",
  description: "Comment se passe une soutenance PFA/PFE, ce que le jury note vraiment, les erreurs classiques, répondre à une question qu'on ne sait pas, le jour J.",
};

const SECTIONS = [
  { id: "deroule", titre: "Comment ça se passe" },
  { id: "jury", titre: "Ce que le jury note vraiment" },
  { id: "erreurs", titre: "Les erreurs classiques" },
  { id: "questions", titre: "Répondre aux questions" },
  { id: "voix", titre: "Voix, regard, corps" },
  { id: "veille", titre: "La veille" },
  { id: "jour-j", titre: "Le jour J" },
  { id: "faq", titre: "Si ça tourne mal" },
] as const;

/**
 * Le guide : ce qu'un étudiant apprend d'habitude après sa première
 * soutenance. Page statique, écrite pour être lue en dix minutes et relue
 * la veille. Les durées sont des ordres de grandeur — chaque école a son
 * règlement, et c'est lui qui fait foi.
 */
export default function GuidePage() {
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
          Une soutenance, c&apos;est <b>un exposé chronométré, puis des questions</b>. Le jury t&apos;accueille, tu présentes, il
          t&apos;interroge, il délibère sans toi, puis il te donne (ou non) son retour. Ordres de grandeur habituels — <b>vérifie
          le règlement de ton école</b>, c&apos;est lui qui compte :
        </p>
        <div className="guide-grille">
          <div className="card guide-carte">
            <b>PFA</b>
            <p>
              10 à 15 minutes d&apos;exposé, 10 à 15 minutes de questions. Jury de deux ou trois enseignants, dont ton encadrant.
            </p>
          </div>
          <div className="card guide-carte">
            <b>PFE</b>
            <p>
              15 à 20 minutes d&apos;exposé, 20 à 30 minutes de questions. Jury de trois à quatre personnes : président, rapporteur,
              encadrant académique, souvent le tuteur en entreprise.
            </p>
          </div>
        </div>
        <p>
          <b>Le temps est sacré.</b> Un jury qui doit en entendre six dans la journée coupe un exposé qui dépasse — et retient
          qu&apos;il a dû le faire. Vise 90 % du temps imparti : si on te donne 20 minutes, prépare 18.
        </p>
        <p>
          <b>Les rôles.</b> Le président mène la séance et surveille l&apos;horloge. Le rapporteur a lu ton rapport de près : ses
          questions portent sur la méthode, les choix, les limites. Ton encadrant te connaît : il pose rarement de piège, mais il
          peut t&apos;aider à préciser une réponse. Le tuteur entreprise veut entendre ce que ton travail a changé concrètement.
        </p>
      </section>

      <section id="jury" className="guide-section">
        <h2>2. Ce que le jury note vraiment</h2>
        <p>
          Les grilles d&apos;évaluation varient, mais elles tournent toutes autour des mêmes questions. Dans l&apos;ordre où
          elles pèsent, en général :
        </p>
        <ol className="guide-liste">
          <li>
            <b>Est-ce que tu maîtrises ton sujet ?</b> Pas « est-ce que c&apos;est réussi » — est-ce que tu comprends ce que tu as
            fait, pourquoi, et ce que ça vaut. On le voit aux réponses, pas aux slides.
          </li>
          <li>
            <b>Est-ce que la démarche tient ?</b> Un problème clair, une méthode choisie pour une raison, des résultats mesurés,
            des limites nommées. Un projet modeste bien mené vaut plus qu&apos;un projet ambitieux flou.
          </li>
          <li>
            <b>As-tu du recul ?</b> Ce que tu referais autrement, ce qui n&apos;a pas marché, ce que tu ne sais pas. Le jury
            se méfie d&apos;un projet sans défaut : il n&apos;existe pas.
          </li>
          <li>
            <b>Est-ce clair ?</b> Un plan annoncé et tenu, une idée par diapositive, une conclusion qui répond à la question du
            début. La clarté, c&apos;est du respect pour le temps du jury.
          </li>
          <li>
            <b>Comment réponds-tu ?</b> Écouter la question jusqu&apos;au bout, y répondre (à elle, pas à une autre), savoir dire
            « je ne sais pas » proprement.
          </li>
          <li>
            <b>Le support et la forme.</b> Lisible du fond de la salle, pas de pavés de texte, chiffres sourcés. Important, mais
            ça ne rattrape jamais le fond.
          </li>
        </ol>
        <p className="guide-encadre">
          <Icone nom="idee" /> Le jury ne note pas ton projet : il note <b>ta compréhension de ton projet</b>. C&apos;est une bonne nouvelle — c&apos;est
          la seule chose qui se prépare encore la dernière semaine.
        </p>
      </section>

      <section id="erreurs" className="guide-section">
        <h2>3. Les erreurs classiques</h2>
        <p>Celles qu&apos;on voit à chaque session, dans cet ordre de fréquence.</p>
        <ol className="guide-liste guide-erreurs">
          <li>
            <b>Lire ses slides.</b> Le jury sait lire. Tes diapositives sont un support, ton exposé est ce que tu ajoutes dessus.
            Si tout est écrit, tu es de trop.
          </li>
          <li>
            <b>Dépasser le temps.</b> L&apos;erreur la plus visible et la plus évitable.{" "}
            <Link href="/app/repetition">Répète avec tes slides</Link> : tu sauras quelle diapositive mange le temps.
          </li>
          <li>
            <b>Pas de plan annoncé.</b> Le jury doit savoir dès la première minute où tu l&apos;emmènes et combien de temps ça
            dure. « Trois parties : le contexte, ce que j&apos;ai construit, ce que ça donne. »
          </li>
          <li>
            <b>Commencer par l&apos;historique de l&apos;entreprise.</b> Une phrase suffit. Le jury veut ton problème, pas la date
            de création de la société.
          </li>
          <li>
            <b>Ne pas connaître ses propres chiffres.</b> Sécher sur le nombre écrit sur ta diapositive 4, c&apos;est ce qui se
            voit le plus. <Link href="/app/fiches">Les fiches</Link> existent pour ça.
          </li>
          <li>
            <b>Dire « on » pour tout.</b> Le jury évalue <i>toi</i>. « J&apos;ai choisi », « j&apos;ai mesuré », « je me suis
            trompé ». « On » pour l&apos;équipe quand c&apos;était l&apos;équipe.
          </li>
          <li>
            <b>Finir sans conclusion.</b> « Voilà, c&apos;est tout » n&apos;est pas une conclusion. Réponds à la question posée au
            début, dis ce que ça vaut, dis ce qui reste à faire, remercie, et arrête-toi.
          </li>
          <li>
            <b>Répondre à côté.</b> On répond à la question qu&apos;on a préparée, pas à celle qui est posée. Reformule-la d&apos;abord.
          </li>
          <li>
            <b>Se défendre au lieu d&apos;écouter.</b> Une critique n&apos;est pas une attaque. « C&apos;est juste. Ce que j&apos;ai
            fait, c&apos;est… et avec plus de temps, je… » vaut mieux que dix minutes de justification.
          </li>
          <li>
            <b>S&apos;excuser.</b> « Désolé, ce n&apos;est pas très bien fait », « je n&apos;ai pas eu le temps de… ». Le jury ne
            l&apos;avait pas remarqué. Maintenant, si.
          </li>
        </ol>
      </section>

      <section id="questions" className="guide-section">
        <h2>4. Répondre aux questions</h2>
        <p>
          C&apos;est la partie qui fait la différence entre deux exposés équivalents — et celle qu&apos;on prépare le moins.{" "}
          <Link href="/app/jury">La simulation d&apos;entretien</Link> sert à ça ; voici la méthode.
        </p>
        <h3>La méthode en quatre temps</h3>
        <ol className="guide-liste">
          <li>
            <b>Écoute jusqu&apos;au bout.</b> Ne prépare pas ta réponse pendant la question. Le jury voit quand tu as décroché.
          </li>
          <li>
            <b>Reformule en une phrase.</b> « Si je comprends bien, vous demandez pourquoi j&apos;ai choisi X plutôt que Y. »
            Ça vérifie que tu as compris, ça te donne trois secondes, et ça montre que tu écoutes.
          </li>
          <li>
            <b>Réponds en trois phrases, avec un exemple.</b> La réponse, la raison, un cas concret de ton projet. Trente à
            soixante secondes.
          </li>
          <li>
            <b>Arrête-toi.</b> Le silence après une bonne réponse n&apos;est pas un vide à remplir. Si le jury veut plus, il
            relancera.
          </li>
        </ol>

        <h3>La question dont tu ne connais pas la réponse</h3>
        <p>Elle viendra. Ce qui compte, c&apos;est la manière :</p>
        <blockquote className="guide-citation">
          « Je n&apos;ai pas exploré ce point. Si je devais le faire, je commencerais par… parce que… »
        </blockquote>
        <p>
          Tu dis la vérité, tu montres que tu sais <i>comment</i> chercher, et tu ramènes la discussion sur ce que tu maîtrises.
          Ne jamais : inventer, bluffer, ou répondre à une autre question en espérant que ça passe. Un jury repère un bluff en
          dix secondes et, à partir de là, doute de tout le reste.
        </p>

        <h3>Les autres cas</h3>
        <ul className="guide-liste">
          <li>
            <b>La critique juste.</b> « C&apos;est exact. » Puis ce que tu as fait malgré tout, puis ce que tu ferais avec plus
            de temps. Accepter vite, c&apos;est de la maîtrise.
          </li>
          <li>
            <b>La critique injuste.</b> « Je comprends la remarque. Dans mon cas, … » — puis le fait précis qui nuance. Calme,
            factuel, sans « mais ».
          </li>
          <li>
            <b>La question piège</b> (« Et si votre modèle se trompe en production ? »). Elle teste ton recul, pas ta solution :
            nomme le risque, dis ce qui existe pour le limiter, dis ce qui manque.
          </li>
          <li>
            <b>La question de ton encadrant.</b> Souvent une perche pour te faire préciser quelque chose de bien. Prends-la.
          </li>
          <li>
            <b>La question à laquelle tu as déjà répondu.</b> Réponds quand même, en deux phrases, sans « comme je l&apos;ai dit ».
          </li>
        </ul>
      </section>

      <section id="voix" className="guide-section">
        <h2>5. Voix, regard, corps</h2>
        <ul className="guide-liste">
          <li>
            <b>Le regard va au jury, pas à l&apos;écran.</b> Balaye les trois personnes ; reviens sur celle qui a posé la question
            quand tu réponds. Un coup d&apos;œil à la diapositive pour la transition, pas plus.
          </li>
          <li>
            <b>Le rythme : 110 à 160 mots par minute.</b> Sous stress, on accélère. Une session d&apos;entraînement te le dit en
            chiffres ; la parade, c&apos;est la pause entre deux idées.
          </li>
          <li>
            <b>Le silence vaut mieux que « euh ».</b> Deux secondes de silence paraissent longues à toi, normales au jury. Un
            « euh » toutes les cinq secondes, lui, s&apos;entend.
          </li>
          <li>
            <b>Debout, ancré, face au jury.</b> Pas adossé au mur, pas derrière l&apos;ordinateur, pas de va-et-vient. Les mains
            libres ; une télécommande ou un stylo si tu ne sais pas quoi en faire.
          </li>
          <li>
            <b>Pointer avec la main, pas avec le laser.</b> Le point rouge qui tremble trahit le stress ; la main, non.
          </li>
          <li>
            <b>La première phrase est apprise par cœur.</b> Uniquement elle. Une fois lancée, le reste suit. La dernière aussi.
          </li>
        </ul>
      </section>

      <section id="veille" className="guide-section">
        <h2>6. La veille</h2>
        <p>
          <b>Relis, ne répète plus.</b> Une dernière répétition la veille au soir fatigue plus qu&apos;elle ne rassure, et une
          mauvaise dernière répétition te suit jusqu&apos;au lendemain.
        </p>
        <ul className="guide-check">
          <li>Pitch relu une fois, à voix basse — l&apos;accroche et la conclusion par cœur</li>
          <li>
            <Link href="/app/fiches">Fiches</Link> révisées une dernière fois, surtout les difficiles
          </li>
          <li>Questions du jury relues — d&apos;abord celles sur les faiblesses</li>
          <li>Slides en PDF sur une clé USB <i>et</i> en ligne, ordinateur et adaptateur chargés</li>
          <li>Tenue prête, trajet vérifié, réveil réglé — couché tôt</li>
        </ul>
      </section>

      <section id="jour-j" className="guide-section">
        <h2>7. Le jour J</h2>
        <ul className="guide-check">
          <li>Arrive 20 minutes en avance ; teste l&apos;affichage sur le matériel de la salle</li>
          <li>De l&apos;eau à portée ; trois respirations lentes avant d&apos;entrer</li>
          <li>Salue le jury, attends qu&apos;on te donne la parole, annonce le plan et la durée</li>
          <li>Regarde les personnes, pas l&apos;écran ; pauses plutôt que « euh »</li>
          <li>Conclusion claire, remerciement, puis silence : les questions arrivent</li>
          <li>Écoute, reformule, réponds en trois phrases, arrête-toi</li>
          <li>Si tu ne sais pas : « Je n&apos;ai pas exploré ce point ; voici comment je l&apos;aborderais… »</li>
          <li>À la fin, remercie — et sors. La délibération se fait sans toi.</li>
        </ul>
        <p className="guide-encadre">
          <Icone nom="soutenance" /> Tu as préparé. Ce que le jury voit, c&apos;est quelqu&apos;un qui connaît son sujet et qui sait écouter. Le reste, c&apos;est du
          détail.
        </p>
      </section>

      <section id="faq" className="guide-section">
        <h2>8. Si ça tourne mal</h2>
        <dl className="guide-faq">
          <dt>Le projecteur ne marche pas.</dt>
          <dd>
            Tu as la clé USB et la version en ligne. Si rien ne marche, tu présentes sans support : tu connais ton plan, ton
            accroche et ta conclusion. Un jury est toujours indulgent avec un problème technique bien géré — et impressionné
            par un exposé tenu sans slides.
          </dd>
          <dt>Tu as un trou.</dt>
          <dd>
            Regarde la diapositive, dis la transition (« Ce qui m&apos;amène à… ») et reprends. Trois secondes pour toi, rien pour
            le jury.
          </dd>
          <dt>Tu dépasses.</dt>
          <dd>
            Saute aux résultats et à la conclusion — jamais à la vitesse. Mieux vaut une partie omise qu&apos;une fin bâclée.
            Annonce-le : « Pour tenir le temps, je passe directement aux résultats. »
          </dd>
          <dt>Un membre du jury est dur, ou semble hostile.</dt>
          <dd>
            C&apos;est souvent un rôle, parfois un style. Reste factuel, réponds à la question, ne te justifie pas au-delà. Les
            autres membres voient la même chose que toi.
          </dd>
          <dt>Tu as fait une erreur dans le rapport et on te la montre.</dt>
          <dd>
            « Vous avez raison, c&apos;est une erreur. » Puis ce que ça change (souvent peu) et la correction. Reconnaître en une
            phrase clôt le sujet ; nier l&apos;ouvre pour dix minutes.
          </dd>
          <dt>On te demande ton avis personnel.</dt>
          <dd>
            Donne-le, avec un argument. « Je pense que…, parce que… » Le jury teste ta capacité à prendre position, pas à
            deviner la sienne.
          </dd>
        </dl>
      </section>

      <footer className="guide-pied">
        <p>
          Prêt à t&apos;y mettre ? <Link href="/app">Ton parcours</Link> te dit quoi faire aujourd&apos;hui.
        </p>
      </footer>
    </article>
  );
}
