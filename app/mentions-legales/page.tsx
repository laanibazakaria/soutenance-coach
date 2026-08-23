import Link from "next/link";
import PageLegale from "@/app/components/PageLegale";

export const metadata = {
  title: "Mentions légales",
  description: "Qui édite SoutenanceCoach, qui l'héberge, sous quelle licence.",
};

export default function MentionsLegalesPage() {
  return (
    <PageLegale titre="Mentions légales" misAJour="23 août 2026">
      <h2>Éditeur</h2>
      <p>
        SoutenanceCoach est un projet personnel, à but non lucratif, édité par <b>Zakaria Laaniba</b>, élève-ingénieur en
        intelligence artificielle à l&apos;ENSIAS (Rabat, Maroc). Contact :{" "}
        <a href="mailto:zakaria.laaniba@gmail.com">zakaria.laaniba@gmail.com</a>.
      </p>

      <h2>Hébergement</h2>
      <ul>
        <li>Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</li>
        <li>Base de données : Neon Inc., 209 Orange Street, Wilmington, DE 19801, États-Unis.</li>
      </ul>

      <h2>Code source et licence</h2>
      <p>
        Le code est public, sous licence MIT :{" "}
        <a href="https://github.com/laanibazakaria/soutenance-coach" target="_blank" rel="noopener noreferrer">
          github.com/laanibazakaria/soutenance-coach
        </a>
        . La structure de l&apos;interface s&apos;inspire de celle de Propulsez Coach IA, avec l&apos;accord de Propulsez ; les couleurs, la police et le logo sont propres à SoutenanceCoach.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Tout est décrit dans la <Link href="/confidentialite">politique de confidentialité</Link> : ce qui est stocké, où,
        pourquoi, et comment le supprimer.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Les mesures, avis et fiches produits par l&apos;application sont des aides à la préparation, pas une évaluation
        officielle. Les indications sur le déroulement des soutenances sont des ordres de grandeur : le règlement de ton
        établissement fait foi. Le service est fourni « en l&apos;état », sans garantie de disponibilité.
      </p>
    </PageLegale>
  );
}
