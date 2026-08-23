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
  {
    href: "/app/guide-pitch",
    icone: "pitch" as const,
    titre: "Le pitch de projet",
    sous: "Concours d'innovation, startup, hackathon",
    sections: ["Ce que cherche un jury d'innovation", "La structure en 3 minutes", "La preuve avant la promesse", "Les questions, et la bonne attitude", "Les erreurs qui coûtent le prix", "Slides et démo", "La veille et le jour J"],
  },
  {
    href: "/app/guide-concours",
    icone: "concours" as const,
    titre: "L'oral de concours",
    sous: "Admission, master, bourse",
    sections: ["Comment ça se passe", "Ce que le jury évalue", "Se présenter en 3 minutes", "Le projet professionnel", "« Pourquoi nous ? » et l'actualité", "Les erreurs classiques", "La veille et le jour J"],
  },
] as const;

/** La bibliothèque : un guide par oral, dix minutes chacun, à relire la veille. */
export default function GuidesPage() {
  return (
    <div className="guides">
      <p className="subtitle">Quatre guides, un par oral. Dix minutes à lire maintenant, cinq à relire la veille — tout ce qu&apos;on découvre d&apos;habitude trop tard.</p>
      <Link href="/app/questions-reelles" className="card accueil-carte card-hover reelles-carte">
        <div className="accueil-carte-tete">
          <IconeBadge nom="parole" teinte="or" />
          <div>
            <h3>Les vraies questions des vrais jurys</h3>
            <p className="session-meta">Racontées par les étudiants passés avant toi, par école et filière. Anonymes, relues.</p>
          </div>
        </div>
      </Link>
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
