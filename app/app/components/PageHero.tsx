"use client";

import { usePathname } from "next/navigation";

interface Entete {
  section: string;
  titre: string;
  sousTitre: string;
}

const ENTETES: ReadonlyArray<{ prefixe: string; exact?: boolean; centre?: boolean; entete: Entete }> = [
  { prefixe: "/app/documents", entete: { section: "Ton dossier", titre: "Mes documents", sousTitre: "Tout ce que le jury lira avant de t'interroger — au même endroit." } },
  { prefixe: "/app/appel", centre: true, entete: { section: "En direct", titre: "L'appel avec le jury IA", sousTitre: "Il parle, tu réponds au micro, il rebondit sur ce que tu viens de dire. Comme le jour J — avec le débrief en plus." } },
  { prefixe: "/app/slides", entete: { section: "Support", titre: "Mes slides", sousTitre: "Analyse, pitch, questions du jury : tout part de ton support." } },
  { prefixe: "/app/repetition", centre: true, entete: { section: "Entraînement", titre: "Répéter avec mes slides", sousTitre: "La diapositive à l'écran, un chrono par diapositive, le bilan à la fin." } },
  { prefixe: "/app/fiches", entete: { section: "Mémoire", titre: "Fiches à mémoriser", sousTitre: "Tes chiffres, tes définitions, tes pièges — par cœur, sans regarder tes slides." } },
  { prefixe: "/app/entretien", entete: { section: "Entretien d'embauche", titre: "Mon entretien", sousTitre: "Le poste, l'offre, ton CV — et tout ce qu'il reste à préparer." } },
  { prefixe: "/app/m/pitch", entete: { section: "Pitch de projet", titre: "Mon pitch", sousTitre: "Ton projet, ton dossier — et tout ce qu'il reste à préparer avant le jury." } },
  { prefixe: "/app/m/concours", entete: { section: "Oral de concours", titre: "Mon oral", sousTitre: "Le programme visé, ton dossier — et tout ce qu'il reste à préparer." } },
  { prefixe: "/app/guide-pitch", entete: { section: "Pitch de projet", titre: "Le guide du pitch", sousTitre: "La structure en 3 minutes, la preuve avant la promesse, les questions d'un jury d'innovation." } },
  { prefixe: "/app/guide-concours", entete: { section: "Oral de concours", titre: "Le guide de l'oral de concours", sousTitre: "Ce que le jury d'admission évalue, se présenter, « pourquoi nous », l'actualité du domaine." } },
  { prefixe: "/app/guide-entretien", entete: { section: "Entretien d'embauche", titre: "Le guide de l'entretien", sousTitre: "Le déroulé, ce que le recruteur évalue, la méthode STAR, les erreurs qui éliminent." } },
  { prefixe: "/app/guide", entete: { section: "Ressources", titre: "Le guide de la soutenance", sousTitre: "Tout ce qu'on découvre d'habitude trop tard. Dix minutes à lire, cinq à relire la veille." } },
  { prefixe: "/app/session", exact: true, centre: true, entete: { section: "Entraînement", titre: "Session d'entraînement", sousTitre: "Parle comme si le jury était en face. La transcription suit en direct." } },
  { prefixe: "/app/bilan", entete: { section: "Où tu en es", titre: "Mon bilan", sousTitre: "Une photographie de ta préparation — à imprimer, ou à partager avec ton encadrant." } },
  { prefixe: "/app/forfaits", entete: { section: "Compte", titre: "Forfaits", sousTitre: "Ce qui est gratuit, ce que Pro apportera, et où tu en es ce mois." } },
  { prefixe: "/app/admin", entete: { section: "Administration", titre: "Tableau de bord", sousTitre: "L'usage réel de la plateforme — sans aucune transcription." } },
  { prefixe: "/app/connexion", entete: { section: "Compte", titre: "Ton compte", sousTitre: "Retrouve tes sessions, ton support et tes fiches sur tous tes appareils." } },
  { prefixe: "/app/question-du-jour", centre: true, entete: { section: "Chaque jour", titre: "La question du jour", sousTitre: "Une question de ton jury, une minute au micro, un retour. Cinq minutes bien placées." } },
  { prefixe: "/app/sessions", entete: { section: "Ton historique", titre: "Mes sessions", sousTitre: "Toutes tes répétitions, tous tes oraux — avec l'avis du coach sur chacune." } },
  { prefixe: "/app/questions-reelles", entete: { section: "Ressources", titre: "Les vraies questions des jurys", sousTitre: "Ce qu'on a réellement demandé aux étudiants passés avant toi — par école et filière." } },
  { prefixe: "/app/guides", entete: { section: "À lire avant", titre: "Les guides", sousTitre: "Un guide par oral. Tout ce qu'on découvre d'habitude trop tard." } },
  { prefixe: "/app/soutenance-blanche", centre: true, entete: { section: "Soutenance", titre: "Soutenance blanche", sousTitre: "L'exposé avec tes slides, le jury qui enchaîne et relance, le débrief. La répétition générale." } },
  { prefixe: "/app/soutenance", entete: { section: "Soutenance", titre: "Ton parcours", sousTitre: "Chaque jour, ce qu'il faut faire — et ce que ton activité a déjà prouvé." } },
];

/** Le bandeau de tête de chaque page : section, titre, une phrase. */
export default function PageHero() {
  const chemin = usePathname();
  const trouve = ENTETES.find((e) => (e.exact ? chemin === e.prefixe : chemin.startsWith(e.prefixe)));
  if (!trouve) return null;
  const { section, titre, sousTitre } = trouve.entete;
  return (
    <section className={`hero${trouve.centre ? " hero-centre" : ""}`} aria-label={titre}>
      <div className="hero-inner">
        <span className="hero-section">{section}</span>
        <h1 className="hero-titre">{titre}</h1>
        <p className="hero-sous">{sousTitre}</p>
      </div>
    </section>
  );
}
