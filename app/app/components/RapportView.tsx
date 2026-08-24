"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { estRapport, empreinteRapport, LIMITES_RAPPORT, type Rapport } from "@/lib/rapport";
import { extraireDeckPDF, ExtractionError } from "@/lib/slides/extract";
import { LIBELLES_CATEGORIES } from "@/lib/jury";
import type { JuryQuestion } from "@/lib/slides/types";
import { pousserTout, surSynchronisation } from "@/lib/sync/client";
import { indexerMemoire, memoireIndexe } from "@/lib/memoire/client";
import { useToast } from "@/app/components/Toast";
import { Icone } from "@/app/components/Icone";
import ListeQuestions from "./ListeQuestions";

export const CLE_RAPPORT = "rapport:texte";
export const cleQuestionsRapport = (texte: string) => `questions-rapport:${empreinteRapport(texte)}`;

/**
 * Le mémoire, le rapport ou la thèse : déposé en PDF (lu dans le navigateur,
 * seul le texte est gardé), il donne les questions du rapporteur — qui
 * rejoignent celles du support dans la simulation et la soutenance blanche.
 */
export default function RapportView() {
  const [rapport, setRapport] = useState<Rapport | null | undefined>(undefined);
  const [questions, setQuestions] = useState<JuryQuestion[] | null>(null);
  const [lecture, setLecture] = useState(false);
  const [generation, setGeneration] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [indexation, setIndexation] = useState<{ fait: number; total: number } | null>(null);
  const [passagesPrets, setPassagesPrets] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  /** L'index de recherche : pendant l'appel, le jury citera les bons passages. */
  async function construireIndex(texte: string, nomFichier: string, pages?: string[]) {
    setIndexation({ fait: 0, total: 1 });
    const r = await indexerMemoire(texte, nomFichier, (fait, total) => setIndexation({ fait, total }), pages);
    setIndexation(null);
    if (r.ok) {
      setPassagesPrets(r.passages);
      toast.success(`Mémoire indexé : ${r.passages} passages. Le jury pourra t'interroger dessus.`);
    } else {
      setPassagesPrets(null);
      toast.error(r.message ?? "L'index du mémoire n'a pas pu être construit.");
    }
  }

  async function deposer(file: File) {
    setLecture(true);
    try {
      const deck = await extraireDeckPDF(file);
      const texte = deck.slides.map((s) => s.texte).join("\n\n").slice(0, LIMITES_RAPPORT.texteChars);
      if (deck.slides.length < LIMITES_RAPPORT.pagesMin || texte.trim().length < 500) {
        throw new ExtractionError("Ce document est trop court ou sans texte lisible (scanné ?). Dépose le PDF texte de ton mémoire.");
      }
      const r: Rapport = { nomFichier: file.name, pages: deck.slides.length, texte, misAJourLe: new Date().toISOString() };
      ecrireCache(window.localStorage, CLE_RAPPORT, r);
      setRapport(r);
      setQuestions(lireCache<JuryQuestion[]>(window.localStorage, cleQuestionsRapport(texte)));
      void pousserTout();
      toast.success(`${deck.slides.length} pages lues. Seul le texte est conservé.`);
      await construireIndex(texte, file.name, deck.slides.map((s) => s.texte));
    } catch (e) {
      toast.error(e instanceof ExtractionError ? e.message : "Le document n'a pas pu être lu.");
    } finally {
      setLecture(false);
    }
  }

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
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void deposer(f);
          e.target.value = "";
        }}
      />
      <div className="list-head" style={{ margin: 0 }}>
        <div>
          <h2 className="list-title" style={{ margin: 0 }}>
            <Icone nom="memoire" /> Ton mémoire, ton rapport, ta thèse
          </h2>
          <p className="session-meta">
            {rapport ? `${rapport.nomFichier} · ${rapport.pages} pages · ${Math.round(rapport.texte.split(/\s+/).length / 100) / 10}k mots lus` : "Le rapporteur l'a lu de près : c'est là qu'il prend ses questions de fond."}
          </p>
        </div>
        <div className="list-actions">
          <button className="btn small" onClick={() => fileRef.current?.click()} disabled={lecture}>
            {lecture ? "Lecture…" : rapport ? "Changer de document" : <><Icone nom="memoire" /> Déposer le PDF</>}
          </button>
          {rapport && (
            <button className="btn small primary" onClick={() => void generer()} disabled={generation}>
              {generation ? "Le rapporteur lit…" : questions ? <><Icone nom="rafraichir" /> Régénérer</> : <><Icone nom="etincelles" /> Questions du rapporteur</>}
            </button>
          )}
        </div>
      </div>
      {!rapport && <p className="report-note" style={{ textAlign: "left", marginTop: 10 }}>Lu dans ton navigateur, seul le texte est conservé — jamais le fichier. Un mémoire de 40 à 100 pages convient.</p>}
      {questions && (
        <>
          <button className="link-btn" style={{ marginTop: 12 }} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
            {ouvert ? "Masquer" : "Voir"} les {questions.length} questions du rapporteur {ouvert ? "▾" : "▸"}
          </button>
          {ouvert && (
            <div style={{ marginTop: 10 }}>
              <ListeQuestions questions={questions.map((q) => ({ id: q.id, categorie: LIBELLES_CATEGORIES[q.categorie], question: q.question, pourquoi: q.pourquoi, priorite: true }))} libellePourquoi="Pourquoi le rapporteur la pose" />
              <p className="report-note" style={{ textAlign: "left" }}>
                Les cinq premières sont déjà dans <Link href="/app/appel?mode=soutenance">l&apos;appel avec le jury</Link> et dans la soutenance blanche.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
