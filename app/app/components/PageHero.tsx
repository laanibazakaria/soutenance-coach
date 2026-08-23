"use client";

import { usePathname } from "next/navigation";

interface Entete {
  section: string;
  titre: string;
  sousTitre: string;
}

const ENTETES: ReadonlyArray<{ prefixe: string; exact?: boolean; entete: Entete }> = [
  { prefixe: "/app/slides", entete: { section: "Support", titre: "Mes slides", sousTitre: "Analyse, pitch, questions du jury : tout part de ton support." } },
  { prefixe: "/app/repetition", entete: { section: "Entraînement", titre: "Répéter avec mes slides", sousTitre: "La diapositive à l'écran, un chrono par diapositive, le bilan à la fin." } },
  { prefixe: "/app/fiches", entete: { section: "Mémoire", titre: "Fiches à mémoriser", sousTitre: "Tes chiffres, tes définitions, tes pièges — par cœur, sans regarder tes slides." } },
  { prefixe: "/app/jury", entete: { section: "Entraînement", titre: "Simulation d'entretien", sousTitre: "Le jury pose une question, tu réponds à voix haute. Comme le jour J." } },
  { prefixe: "/app/entretien/simulation", entete: { section: "Entretien d'embauche", titre: "Simulation avec le recruteur", sousTitre: "Il pose, tu réponds au micro, il te dit ce qui manque — et ce qu'il relancerait." } },
  { prefixe: "/app/entretien", entete: { section: "Entretien d'embauche", titre: "Mon entretien", sousTitre: "Le poste, l'offre, ton CV — et tout ce qu'il reste à préparer." } },
  { prefixe: "/app/guide-entretien", entete: { section: "Entretien d'embauche", titre: "Le guide de l'entretien", sousTitre: "Le déroulé, ce que le recruteur évalue, la méthode STAR, les erreurs qui éliminent." } },
  { prefixe: "/app/guide", entete: { section: "Ressources", titre: "Le guide de la soutenance", sousTitre: "Tout ce qu'on découvre d'habitude trop tard. Dix minutes à lire, cinq à relire la veille." } },
  { prefixe: "/app/session", entete: { section: "Entraînement", titre: "Session d'entraînement", sousTitre: "Parle comme si le jury était en face. La transcription suit en direct." } },
  { prefixe: "/app/connexion", entete: { section: "Compte", titre: "Ton compte", sousTitre: "Retrouve tes sessions, ton support et tes fiches sur tous tes appareils." } },
  { prefixe: "/app", exact: true, entete: { section: "Tableau de bord", titre: "Ton parcours", sousTitre: "Chaque jour, ce qu'il faut faire — et ce que ton activité a déjà prouvé." } },
];

/** Le bandeau de tête de chaque page : section, titre, une phrase. */
export default function PageHero() {
  const chemin = usePathname();
  const trouve = ENTETES.find((e) => (e.exact ? chemin === e.prefixe : chemin.startsWith(e.prefixe)));
  if (!trouve) return null;
  const { section, titre, sousTitre } = trouve.entete;
  return (
    <section className="hero" aria-label={titre}>
      <div className="hero-inner">
        <span className="hero-section">{section}</span>
        <h1 className="hero-titre">{titre}</h1>
        <p className="hero-sous">{sousTitre}</p>
      </div>
    </section>
  );
}
