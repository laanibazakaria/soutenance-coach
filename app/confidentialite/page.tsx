import Link from "next/link";
import PageLegale from "@/app/components/PageLegale";

export const metadata = {
  title: "Politique de confidentialité",
  description: "Ce que SoutenanceCoach stocke, où, pourquoi, et comment tout supprimer.",
};

const MISE_A_JOUR = "23 août 2026";

export default function ConfidentialitePage() {
  return (
    <PageLegale titre="Politique de confidentialité" misAJour={MISE_A_JOUR}>
      <p>
        SoutenanceCoach est un projet personnel, gratuit et sans publicité, construit par un étudiant pour des étudiants.
        Cette page dit <b>exactement</b> ce qui est stocké, où, pourquoi — et comment tout effacer. Elle est écrite pour être
        lue, pas pour couvrir quelqu&apos;un.
      </p>

      <h2>1. Sans compte : rien ne quitte ton navigateur</h2>
      <p>
        Par défaut, tout vit dans le stockage local de ton navigateur : tes sessions (transcriptions, durées, mesures), le
        texte extrait de tes slides, ton parcours, tes fiches. Aucun serveur ne les reçoit. Tu peux le vérifier dans
        l&apos;onglet « Réseau » des outils de développement.
      </p>
      <p>
        <b>L&apos;audio n&apos;est jamais envoyé.</b> La transcription est faite par ton navigateur (Web Speech API, Chrome ou
        Edge) ; seul le texte en résulte. L&apos;enregistrement audio peut être conservé <b>sur ton appareil uniquement</b>
        (pour te réécouter) : il n&apos;est ni synchronisé ni transmis, et il est effacé avec la session, à la déconnexion et
        à la suppression du compte. Le PDF de tes slides ou de ton mémoire est lu dans ton navigateur ; seul son texte est
        conservé.
      </p>

      <h2>2. Les fonctions IA : ce qui est envoyé</h2>
      <p>
        Quand tu demandes explicitement un pitch, des questions de jury, des fiches, un avis du coach ou l&apos;avis du jury
        sur une réponse, <b>du texte</b> est envoyé au modèle de langage de Google (API Gemini) via notre serveur : le texte
        de tes slides et/ou la transcription concernée. Jamais l&apos;audio, jamais le PDF, jamais ton identité. Ces appels
        ne sont pas déclenchés en arrière-plan : chacun correspond à un bouton que tu as pressé. Google traite ces données
        selon ses propres conditions ; nous ne les utilisons pour rien d&apos;autre que te rendre la réponse.
      </p>

      <h2>3. Avec un compte Google (facultatif)</h2>
      <p>Si tu te connectes, nous stockons sur notre serveur :</p>
      <ul>
        <li>
          <b>Ton identité Google</b> : nom, adresse e-mail, photo de profil, identifiant Google. Rien d&apos;autre — pas ton
          agenda, pas tes contacts, pas tes fichiers.
        </li>
        <li>
          <b>Ton travail</b> : sessions (transcriptions, durées, temps par diapositive), texte de tes slides, parcours,
          résultats IA (pitch, questions, fiches, avis). Même forme que dans ton navigateur : le compte est une copie qui te
          suit d&apos;un appareil à l&apos;autre.
        </li>
      </ul>
      <p>
        Finalité unique : retrouver ton travail sur tous tes appareils. Pas de profilage, pas de publicité, pas de revente,
        pas d&apos;entraînement de modèle.
      </p>

      <h2>4. Où c&apos;est hébergé</h2>
      <ul>
        <li>
          <b>Application</b> : Vercel Inc. (États-Unis / réseau mondial).
        </li>
        <li>
          <b>Base de données</b> : Neon Inc., région AWS us-east-2 (États-Unis), chiffrée en transit et au repos.
        </li>
        <li>
          <b>IA</b> : Google LLC (API Gemini), uniquement pour les fonctions décrites au point 2.
        </li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        Un seul cookie, strictement nécessaire : celui de ta session de connexion, si tu te connectes. Aucun cookie de
        mesure d&apos;audience, aucun traceur tiers — d&apos;où l&apos;absence de bandeau.
      </p>

      <h2>6. Conservation et suppression</h2>
      <ul>
        <li>Chaque session se supprime individuellement, depuis l&apos;historique — localement et sur ton compte.</li>
        <li>
          À la déconnexion, l&apos;appareil est vidé après un dernier envoi vers ton compte (sur un ordinateur partagé, la
          personne suivante ne voit rien).
        </li>
        <li>
          <b>Supprimer ton compte</b> efface immédiatement et définitivement tout ce qui lui est rattaché : identité, sessions,
          support, parcours, résultats IA. Bouton sur la page <Link href="/app/connexion">Ton compte</Link>.
        </li>
        <li>Sans suppression de ta part, les données sont conservées tant que le compte existe.</li>
      </ul>

      <h2>7. Tes droits</h2>
      <p>
        Accès, rectification, effacement, portabilité : tout est dans l&apos;application (export JSON de tes sessions,
        suppression session par session, suppression du compte). Pour toute question ou demande qui ne passerait pas par
        l&apos;application : <a href="mailto:zakaria.laaniba@gmail.com">zakaria.laaniba@gmail.com</a>.
      </p>

      <h2>8. Ce que cette page n&apos;est pas</h2>
      <p>
        Un service professionnel avec une équipe et des garanties de disponibilité. C&apos;est un projet d&apos;étudiant, hébergé
        sur des offres gratuites. Exporte régulièrement tes sessions si elles comptent pour toi.
      </p>
    </PageLegale>
  );
}
