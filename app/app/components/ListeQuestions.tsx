"use client";

import { useState } from "react";
import Link from "next/link";
import { Icone } from "@/app/components/Icone";

export interface QuestionListe {
  id: string;
  categorie: string;
  question: string;
  pourquoi?: string;
  attendu?: string;
  /** Question propre au projet (générée) : mise en avant. */
  priorite?: boolean;
  slide?: number;
}

/**
 * Une liste de questions compacte : une ligne par question (numéro,
 * catégorie, texte), qui se déplie pour montrer ce que le jury vérifie et ce
 * qu'une bonne réponse contient. Même composant pour le jury, le recruteur,
 * le rapporteur.
 */
export default function ListeQuestions({
  questions,
  libellePourquoi = "Ce qu'il vérifie",
  libelleAttendu = "Une bonne réponse",
  lienEntrainement,
  libelleEntrainement = "M'entraîner sur ces questions",
}: {
  questions: QuestionListe[];
  libellePourquoi?: string;
  libelleAttendu?: string;
  lienEntrainement?: string;
  libelleEntrainement?: string;
}) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  if (questions.length === 0) return null;
  return (
    <div className="questions-liste">
      {questions.map((q, i) => {
        const estOuverte = ouverte === q.id;
        const aDetail = Boolean(q.pourquoi || q.attendu || q.slide);
        return (
          <div key={q.id} className={`question-ligne${estOuverte ? " ouverte" : ""}${q.priorite ? " priorite" : ""}`}>
            {aDetail ? (
              <button type="button" className="question-ligne-tete" onClick={() => setOuverte(estOuverte ? null : q.id)} aria-expanded={estOuverte} aria-controls={`q-detail-${q.id}`}>
                <span className="question-ligne-num">{i + 1}</span>
                <span className="question-ligne-texte">{q.question}</span>
                <span className="question-ligne-cat">{q.categorie}</span>
                <Icone nom={estOuverte ? "chevronBas" : "chevronDroite"} taille={16} className="question-ligne-chevron" />
              </button>
            ) : (
              <div className="question-ligne-tete">
                <span className="question-ligne-num">{i + 1}</span>
                <span className="question-ligne-texte">{q.question}</span>
                <span className="question-ligne-cat">{q.categorie}</span>
              </div>
            )}
            {estOuverte && aDetail && (
              <div className="question-ligne-detail" id={`q-detail-${q.id}`}>
                {q.pourquoi && (
                  <p>
                    <b>{libellePourquoi} :</b> {q.pourquoi}
                  </p>
                )}
                {q.attendu && (
                  <p>
                    <b>{libelleAttendu} :</b> {q.attendu}
                  </p>
                )}
                {q.slide && <span className="question-slide">Diapositive {q.slide}</span>}
              </div>
            )}
          </div>
        );
      })}
      {lienEntrainement && (
        <Link href={lienEntrainement} className="btn small primary questions-liste-cta">
          <Icone nom="micro" /> {libelleEntrainement}
        </Link>
      )}
    </div>
  );
}
