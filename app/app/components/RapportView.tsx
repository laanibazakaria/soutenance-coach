"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { estRapport, empreinteRapport, type Rapport } from "@/lib/rapport";
import { LIBELLES_CATEGORIES } from "@/lib/jury";
import type { JuryQuestion } from "@/lib/slides/types";
import { pousserTout, surSynchronisation } from "@/lib/sync/client";
import { memoireIndexe } from "@/lib/memoire/client";
import { useToast } from "@/app/components/Toast";
import { Icone } from "@/app/components/Icone";
import ListeQuestions from "./ListeQuestions";

export const CLE_RAPPORT = "rapport:texte";
export const cleQuestionsRapport = (texte: string) => `questions-rapport:${empreinteRapport(texte)}`;

/** « 97 mots lus », pas « 0.1k mots lus » : arrondir en milliers sous mille efface le nombre. */
function motsLus(texte: string): string {
  const n = texte.split(/\s+/).filter(Boolean).length;
  return n < 1000 ? `${n} mots lus` : `${Math.round(n / 100) / 10} k mots lus`;
}

/**
 * Le mémoire, le rapport ou la thèse : déposé en PDF (lu dans le navigateur,
 * seul le texte est gardé), il donne les questions du rapporteur — qui
 * rejoignent celles du support dans la simulation et la soutenance blanche.
 */
export default function RapportView() {
  const [rapport, setRapport] = useState<Rapport | null | undefined>(undefined);
  const [questions, setQuestions] = useState<JuryQuestion[] | null>(null);
  const [generation, setGeneration] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [passagesPrets, setPassagesPrets] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    const lire = () => {
      const r = lireCache<unknown>(window.localStorage, CLE_RAPPORT);
      const ok = estRapport(r) ? r : null;
      setRapport(ok);
      setQuestions(ok ? lireCache<JuryQuestion[]>(window.localStorage, cleQuestionsRapport(ok.texte)) : null);
    };
    lire();
    void memoireIndexe().then((i) => setPassagesPrets(i?.passages.length ?? null));
    return surSynchronisation(lire);
  }, []);

  async function generer() {
    if (!rapport) return;
    setGeneration(true);
    try {
      const res = await fetch("/api/rapport/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nomFichier: rapport.nomFichier, pages: rapport.pages, texte: rapport.texte }) });
      const data = (await res.json()) as { questions?: JuryQuestion[]; erreur?: string };
      if (res.ok && data.questions) {
        ecrireCache(window.localStorage, cleQuestionsRapport(rapport.texte), data.questions);
        // Les questions du rapporteur rejoignent celles du support pour la simulation et la blanche.
        const courantes = lireCache<JuryQuestion[]>(window.localStorage, "questions-courantes") ?? [];
        ecrireCache(window.localStorage, "questions-courantes", [...data.questions.slice(0, 5), ...courantes.filter((q) => !q.id.startsWith("rapport-"))]);
        setQuestions(data.questions);
        setOuvert(true);
        void pousserTout();
        toast.success(`${data.questions.length} questions du rapporteur préparées — elles rejoignent la simulation.`);
      } else toast.error(data.erreur ?? "Les questions n'ont pas pu être générées.");
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setGeneration(false);
    }
  }

  if (rapport === undefined) return null;

  return (
    <section className="card rapport" id="rapport">
      <div className="list-head" style={{ margin: 0 }}>
        <div>
          <h2 className="list-title" style={{ margin: 0 }}>
            <Icone nom="memoire" /> Ton mémoire, ton rapport, ta thèse
          </h2>
          <p className="session-meta">
            {rapport ? `${rapport.nomFichier} · ${rapport.pages} pages · ${motsLus(rapport.texte)}${passagesPrets ? ` · ${passagesPrets} passages indexés` : ""}` : "Le rapporteur l'a lu de près : c'est là qu'il prend ses questions de fond."}
          </p>
        </div>
        <div className="list-actions">
          <Link href="/app/documents" className={`btn small${rapport ? "" : " primary"}`}>
            {rapport ? "Changer de document" : <><Icone nom="memoire" /> Déposer mon document</>}
          </Link>
          {rapport && (
            <button className="btn small primary" onClick={() => void generer()} disabled={generation}>
              {generation ? "Le rapporteur lit…" : questions ? <><Icone nom="rafraichir" /> Régénérer</> : <><Icone nom="etincelles" /> Questions du rapporteur</>}
            </button>
          )}
        </div>
      </div>
      {!rapport && <p className="report-note a-gauche" style={{ marginTop: 10 }}>Il se dépose avec le reste de ton dossier, dans <Link href="/app/documents">tes documents</Link>. PDF ou PowerPoint (.pptx) ; un mémoire de 40 à 100 pages convient.</p>}
      {questions && (
        <>
          <button className="link-btn" style={{ marginTop: 12 }} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
            {ouvert ? "Masquer" : "Voir"} les {questions.length} questions du rapporteur {ouvert ? "▾" : "▸"}
          </button>
          {ouvert && (
            <div style={{ marginTop: 10 }}>
              <ListeQuestions questions={questions.map((q) => ({ id: q.id, categorie: LIBELLES_CATEGORIES[q.categorie], question: q.question, pourquoi: q.pourquoi, priorite: true }))} libellePourquoi="Pourquoi le rapporteur la pose" />
              <p className="report-note a-gauche">
                Les cinq premières sont déjà dans <Link href="/app/appel?mode=soutenance">l&apos;appel avec le jury</Link> et dans la soutenance blanche.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
