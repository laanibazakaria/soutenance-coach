import Link from "next/link";
import { IconeBadge } from "@/app/components/Icone";

export const metadata = { title: "Les guides" };

const GUIDES = [
  {
    href: "/app/guide",
    icone: "soutenance" as const,
    titre: "La soutenance",
    sous: "PFA, PFE, mémoire, thèse",
    sections: ["Comment ça se passe", "Ce que le jury note vraiment", "Les erreurs classiques", "Répondre aux questions", "Voix, regard, corps", "La veille", "Le jour J", "Si ça tourne mal"],
  },
  {
    href: "/app/guide-entretien",
    icone: "entretien" as const,
    titre: "L'entretien d'embauche",
    sous: "Stage, alternance, premier emploi",
    sections: ["Comment ça se passe", "Ce que le recruteur évalue", "« Présentez-vous » en 2 minutes", "La méthode STAR", "Les erreurs qui éliminent", "Tes questions pour eux", "Le salaire", "La veille et le jour J", "Après l'entretien"],
  },
] as const;

/** La bibliothèque : un guide par oral, dix minutes chacun, à relire la veille. */
export default function GuidesPage() {
  return (
    <div className="guides">
      <p className="subtitle">Deux guides, un par oral. Dix minutes à lire maintenant, cinq à relire la veille — tout ce qu&apos;on découvre d&apos;habitude trop tard.</p>
      <div className="accueil-grille">
        {GUIDES.map((g) => (
          <article key={g.href} className="card accueil-carte card-hover">
            <div className="accueil-carte-tete">
              <IconeBadge nom={g.icone} />
              <div>
                <h3>{g.titre}</h3>
                <p className="session-meta">{g.sous}</p>
              </div>
            </div>
            <ol className="guides-sommaire">
              {g.sections.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <Link href={g.href} className="btn small primary">
              Lire le guide →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
