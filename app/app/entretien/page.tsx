"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  etapesEntretien,
  questionsClassiques,
  LIBELLES_CATEGORIES_ENTRETIEN,
  type Candidature,
  type QuestionEntretien,
  type TypeEntretien,
} from "@/lib/entretien";
import { lireCandidature, sauverCandidature, marquerEtapeEntretien, cleQuestionsEntretien } from "@/lib/entretien/persistance";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { listSessions } from "@/lib/storage";
import { dateDuJour, joursEntre } from "@/lib/parcours";
import { extraireDeck, ExtractionError } from "@/lib/slides/extract";
import { pousserTout, surSynchronisation } from "@/lib/sync/client";
import { useToast } from "@/app/components/Toast";
import { telechargerIcs } from "@/lib/ics";
import { Icone } from "@/app/components/Icone";
import ListeQuestions from "../components/ListeQuestions";

const TYPES: ReadonlyArray<{ id: TypeEntretien; label: string; hint: string }> = [
  { id: "rh", label: "RH", hint: "motivation, parcours" },
  { id: "technique", label: "Technique", hint: "compétences, projets" },
  { id: "mixte", label: "Mixte", hint: "les deux" },
];

function dateLongue(d: string): string {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(a ?? 2026, (m ?? 1) - 1, j ?? 1).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Le hub du module Entretien : profil de candidature, checklist, questions. */
export default function EntretienPage() {
  const [candidature, setCandidature] = useState<Candidature | null | undefined>(undefined);
  const [edition, setEdition] = useState(false);
  const [questions, setQuestions] = useState<QuestionEntretien[] | null>(null);
  const [generation, setGeneration] = useState(false);
  const [nbSessions, setNbSessions] = useState(0);
  const [sessionsEntretien, setSessionsEntretien] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const lire = () => {
      const c = lireCandidature(window.localStorage);
      setCandidature(c);
      setQuestions(c ? lireCache<QuestionEntretien[]>(window.localStorage, cleQuestionsEntretien(c)) : null);
      const sessions = listSessions(window.localStorage);
      setNbSessions(sessions.length);
      setSessionsEntretien(sessions.filter((s) => s.mode === "entretien").length);
    };
    lire();
    return surSynchronisation(lire);
  }, []);

  if (candidature === undefined) return null;

  function enregistrer(c: Candidature) {
    sauverCandidature(window.localStorage, c);
    setCandidature(c);
    setQuestions(lireCache<QuestionEntretien[]>(window.localStorage, cleQuestionsEntretien(c)));
    setEdition(false);
    void pousserTout();
    toast.success("Profil enregistré.");
  }

  function cocher(id: string, faite: boolean) {
    const c = marquerEtapeEntretien(window.localStorage, id, faite);
    if (c) {
      setCandidature(c);
      void pousserTout();
    }
  }

  async function genererQuestions() {
    if (!candidature) return;
    setGeneration(true);
    try {
      const res = await fetch("/api/entretien/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidature }),
      });
      const data = (await res.json()) as { questions?: QuestionEntretien[]; erreur?: string };
      if (res.ok && data.questions) {
        ecrireCache(window.localStorage, cleQuestionsEntretien(candidature), data.questions);
        ecrireCache(window.localStorage, "entretien-questions-courantes", data.questions);
        setQuestions(data.questions);
        void pousserTout();
        toast.success(`${data.questions.length} questions préparées pour ce poste.`);
      } else {
        toast.error(data.erreur ?? "Les questions n'ont pas pu être générées.");
      }
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setGeneration(false);
    }
  }

  if (!candidature || edition) {
    return <FormulaireCandidature initial={candidature ?? null} onValider={enregistrer} onAnnuler={candidature ? () => setEdition(false) : undefined} />;
  }

  const etapes = etapesEntretien({
    candidature,
    sessions: Array.from({ length: sessionsEntretien }, (_, i) => ({ id: String(i), startedAt: "", durationMs: 0, transcript: "", wordCount: 0, mode: "entretien" as const })),
    questionsGenerees: questions !== null,
  });
  const faites = etapes.filter((e) => e.faite).length;
  const pct = Math.round((faites / etapes.length) * 100);
  const jours = candidature.dateEntretien ? joursEntre(dateDuJour(), candidature.dateEntretien) : null;
  const classiques = questionsClassiques(candidature.typeEntretien === "mixte" ? "les-deux" : candidature.typeEntretien);

  return (
    <div className="entretien">
      <section className="card parcours" id="profil">
        <div className="parcours-head">
          <div>
            <div className="parcours-sur">
              {candidature.poste || "Poste"} · {candidature.entreprise || "Entreprise"} · entretien {TYPES.find((t) => t.id === candidature.typeEntretien)?.label.toLowerCase()}
            </div>
            <h2 className="parcours-titre">
              {jours === null
                ? "Prépare ton entretien"
                : jours < 0
                  ? "L'entretien est passé — bravo !"
                  : jours === 0
                    ? "C'est aujourd'hui."
                    : jours === 1
                      ? "C'est demain."
                      : `Dans ${jours} jours`}
            </h2>
            {candidature.dateEntretien && jours !== null && jours >= 0 && <p className="session-meta">{dateLongue(candidature.dateEntretien)}</p>}
          </div>
          {jours !== null && jours >= 0 && <div className={`jmoins ${pct >= 80 ? "jmoins-pret" : pct >= 40 ? "jmoins-encours" : "jmoins-debut"}`}>J-{jours}</div>}
        </div>
        <div className="jauge" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Préparation">
          <div className={`jauge-barre ${pct >= 80 ? "jauge-pret" : pct >= 40 ? "jauge-encours" : "jauge-debut"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="jauge-texte">
          <b>Prêt à {pct} %</b> — {faites}/{etapes.length} étapes
        </p>
        <ul className="etapes">
          {etapes.map((e) => (
            <li key={e.id} className={`etape etape-${e.faite ? "faite" : "aujourdhui"}`}>
              <label className="etape-check">
                <input type="checkbox" checked={e.faite} disabled={e.source === "auto"} onChange={(ev) => cocher(e.id, ev.target.checked)} aria-label={e.titre} />
              </label>
              <div className="etape-corps">
                <div className="etape-ligne">
                  <b className="etape-titre">{e.titre}</b>
                  {e.source === "auto" && <span className="etape-tag etape-tag-auto">détectée ✓</span>}
                </div>
                {!e.faite && <p className="etape-pourquoi">{e.pourquoi}</p>}
              </div>
              {!e.faite && (
                <Link href={e.lien} className="btn small etape-action">
                  {e.action} →
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="parcours-pied">
          <button className="link-btn" onClick={() => setEdition(true)}>
            Modifier le profil
          </button>
          <Link href="/app/appel?mode=entretien" className="link-btn">
            Lancer la simulation →
          </Link>
          {candidature.dateEntretien && (
            <button
              className="link-btn"
              onClick={() =>
                telechargerIcs({
                  titre: `Entretien ${[candidature.poste, candidature.entreprise].filter(Boolean).join(" — ")}`,
                  date: candidature.dateEntretien!,
                  description: "Préparé avec SoutenanceCoach.",
                  url: "https://soutenance-coach.vercel.app/app/entretien",
                })
              }
            >
              <Icone nom="calendrier" /> Ajouter au calendrier
            </button>
          )}
        </div>
      </section>

      {jours !== null && jours < 0 && (
        <section className="card">
          <h2 className="list-title" style={{ marginTop: 0 }}>L&apos;entretien est passé</h2>
        </section>
      )}


      <section id="questions">
        <div className="list-head">
          <h2 className="list-title">Les questions de ce recruteur</h2>
          <button className="btn small primary" onClick={() => void genererQuestions()} disabled={generation}>
            {generation ? "Le recruteur lit ton CV…" : questions ? <><Icone nom="rafraichir" /> Régénérer</> : <><Icone nom="etincelles" /> Générer depuis mon CV et l'offre</>}
          </button>
        </div>
        {!questions ? (
          <div className="ia-invite">
            <h2>Des questions pour toi, pas pour n&apos;importe qui</h2>
            <p>
              Le recruteur IA lit ton CV et l&apos;offre, repère les écarts et les affirmations à prouver, et prépare dix questions avec,
              pour chacune, ce qu&apos;il vérifie et ce qu&apos;une bonne réponse contient.
            </p>
            <p className="dropzone-note reassure-note">Seul le texte de ton CV et de l&apos;offre est envoyé — jamais le fichier.</p>
          </div>
        ) : (
          <ListeQuestions questions={questions.map(enLigne)} lienEntrainement="/app/appel?mode=entretien" libelleEntrainement="M'entraîner avec le recruteur" />
        )}

        <details className="classiques">
          <summary>Les {classiques.length} questions classiques — avec ce qu&apos;une bonne réponse contient</summary>
          <ListeQuestions questions={classiques.map(enLigne)} />
        </details>
      </section>

      {nbSessions === 0 && (
        <p className="report-note" style={{ marginTop: 24 }}>
          Astuce : commence par <Link href="/app/session?mode=entretien&format=2">« Présentez-vous » en 2 minutes</Link> — le coach comparera ton pitch à ton CV et à l&apos;offre.
        </p>
      )}
    </div>
  );
}

function enLigne(q: QuestionEntretien) {
  return {
    id: q.id,
    categorie: (() => {
      const base = LIBELLES_CATEGORIES_ENTRETIEN[q.categorie];
      const cible = q.cible === "rh" ? "RH" : q.cible === "technique" ? "technique" : null;
      return cible && base.toLowerCase() !== cible.toLowerCase() ? `${base} · ${cible}` : base;
    })(),
    question: q.question,
    pourquoi: q.pourquoi,
    attendu: q.attendu,
    priorite: q.source === "ia",
  };
}

function FormulaireCandidature({
  initial,
  onValider,
  onAnnuler,
}: {
  initial: Candidature | null;
  onValider: (c: Candidature) => void;
  onAnnuler?: () => void;
}) {
  const [poste, setPoste] = useState(initial?.poste ?? "");
  const [entreprise, setEntreprise] = useState(initial?.entreprise ?? "");
  const [type, setType] = useState<TypeEntretien>(initial?.typeEntretien ?? "mixte");
  const [date, setDate] = useState(initial?.dateEntretien ?? "");
  const [offre, setOffre] = useState(initial?.offre ?? "");
  const [cvTexte, setCvTexte] = useState(initial?.cvTexte ?? "");
  const [cvNom, setCvNom] = useState(initial?.cvNomFichier ?? "");
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valide = poste.trim() !== "" && (offre.trim() !== "" || cvTexte.trim() !== "");

  async function lireCV(file: File) {
    setLecture(true);
    setErreur(null);
    try {
      const deck = await extraireDeck(file);
      const texte = deck.slides.map((s) => s.texte).join("\n");
      if (texte.trim().length < 50) throw new ExtractionError("Ce PDF ne contient pas de texte lisible (CV scanné ?). Exporte-le depuis Word ou Canva en PDF texte.");
      setCvTexte(texte);
      setCvNom(file.name);
    } catch (e) {
      setErreur(e instanceof ExtractionError ? e.message : "Le CV n'a pas pu être lu.");
    } finally {
      setLecture(false);
    }
  }

  return (
    <section className="card parcours parcours-form" aria-label="Ma candidature">
      <h2 className="parcours-titre"><Icone nom="entretien" /> Pour quel entretien te prépares-tu ?</h2>
      <p className="parcours-lead">
        Le poste, l&apos;offre et ton CV : tout ce qui suit — questions, simulation, avis du coach — sera personnalisé à partir de là.
        Le CV est lu dans ton navigateur ; seul son texte est conservé.
      </p>
      <form
        className="parcours-champs"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!valide) return;
          onValider({
            poste: poste.trim(),
            entreprise: entreprise.trim(),
            typeEntretien: type,
            dateEntretien: date || undefined,
            offre,
            cvTexte,
            cvNomFichier: cvNom || undefined,
            etapesFaites: initial?.etapesFaites ?? {},
            misAJourLe: new Date().toISOString(),
          });
        }}
      >
        <div className="champs-ligne">
          <label className="champ">
            <span>Poste visé *</span>
            <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Ingénieur IA junior" required />
          </label>
          <label className="champ">
            <span>Entreprise</span>
            <input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Nom de l'entreprise" />
          </label>
          <label className="champ">
            <span>Date de l&apos;entretien</span>
            <input type="date" value={date} min={dateDuJour()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <fieldset className="formats formats-inline">
          <legend>Type d&apos;entretien</legend>
          {TYPES.map((t) => (
            <button key={t.id} type="button" className={`format-btn${type === t.id ? " active" : ""}`} onClick={() => setType(t.id)}>
              {t.label}
              <span className="format-hint"> · {t.hint}</span>
            </button>
          ))}
        </fieldset>
        <label className="champ champ-large">
          <span>L&apos;offre d&apos;emploi (colle le texte)</span>
          <textarea value={offre} onChange={(e) => setOffre(e.target.value)} rows={7} placeholder="Missions, profil recherché, compétences exigées…" />
        </label>
        <div className="champ champ-large">
          <span>Ton CV (PDF)</span>
          <div className="cv-ligne">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void lireCV(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()} disabled={lecture}>
              {lecture ? "Lecture…" : cvNom ? "Changer de CV" : "Choisir mon CV"}
            </button>
            {cvNom && (
              <span className="session-meta">
                ✓ {cvNom} · {cvTexte.split(/\s+/).length} mots lus
              </span>
            )}
          </div>
          {erreur && (
            <p className="warn" role="alert">
              {erreur}
            </p>
          )}
        </div>
        <div className="actions">
          {onAnnuler && (
            <button type="button" className="btn" onClick={onAnnuler}>
              Annuler
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!valide}>
            {initial ? "Mettre à jour" : "Préparer mon entretien"}
          </button>
        </div>
        {!valide && <p className="report-note">Il faut le poste, et au moins l&apos;offre ou le CV.</p>}
      </form>
    </section>
  );
}
