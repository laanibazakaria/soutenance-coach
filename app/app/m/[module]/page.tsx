"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MODULES, estModuleId, etapesModule, questionsClassiquesModule, type ModuleOral, type ProfilModule } from "@/lib/modules";
import { lireProfil, sauverProfil, marquerEtapeModule, cleQuestionsModule } from "@/lib/modules/persistance";
import { LIBELLES_CATEGORIES_ENTRETIEN, type QuestionEntretien } from "@/lib/entretien";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { listSessions } from "@/lib/storage";
import { dateDuJour, joursEntre } from "@/lib/parcours";
import { extraireDeckPDF, ExtractionError } from "@/lib/slides/extract";
import { pousserTout, surSynchronisation } from "@/lib/sync/client";
import { useToast } from "@/app/components/Toast";
import { telechargerIcs } from "@/lib/ics";
import RepeterAvecAmi from "../../components/RepeterAvecAmi";
import RetourOralForm from "../../components/RetourOralForm";
import { Icone } from "@/app/components/Icone";

function dateLongue(d: string): string {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(a ?? 2026, (m ?? 1) - 1, j ?? 1).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Le hub générique d'un module d'oral : profil, checklist, questions. */
export default function ModulePage() {
  const params = useParams<{ module: string }>();
  const id = params.module;
  if (!estModuleId(id)) {
    return (
      <div className="empty">
        Ce module n&apos;existe pas. <Link href="/app">Retour au parcours →</Link>
      </div>
    );
  }
  return <Hub m={MODULES[id]} />;
}

function Hub({ m }: { m: ModuleOral }) {
  const [profil, setProfil] = useState<ProfilModule | null | undefined>(undefined);
  const [edition, setEdition] = useState(false);
  const [questions, setQuestions] = useState<QuestionEntretien[] | null>(null);
  const [generation, setGeneration] = useState(false);
  const [sessionsModule, setSessionsModule] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const lire = () => {
      const p = lireProfil(window.localStorage, m.id);
      setProfil(p);
      setQuestions(p ? lireCache<QuestionEntretien[]>(window.localStorage, cleQuestionsModule(p)) : null);
      setSessionsModule(listSessions(window.localStorage).filter((s) => s.mode === m.id).length);
    };
    lire();
    return surSynchronisation(lire);
  }, [m.id]);

  if (profil === undefined) return null;

  function enregistrer(p: ProfilModule) {
    sauverProfil(window.localStorage, p);
    setProfil(p);
    setQuestions(lireCache<QuestionEntretien[]>(window.localStorage, cleQuestionsModule(p)));
    setEdition(false);
    void pousserTout();
    toast.success("Profil enregistré.");
  }

  function cocher(id: string, faite: boolean) {
    const p = marquerEtapeModule(window.localStorage, m.id, id, faite);
    if (p) {
      setProfil(p);
      void pousserTout();
    }
  }

  async function generer() {
    if (!profil) return;
    setGeneration(true);
    try {
      const res = await fetch("/api/modules/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profil }) });
      const data = (await res.json()) as { questions?: QuestionEntretien[]; erreur?: string };
      if (res.ok && data.questions) {
        ecrireCache(window.localStorage, cleQuestionsModule(profil), data.questions);
        setQuestions(data.questions);
        void pousserTout();
        toast.success(`${data.questions.length} questions préparées.`);
      } else toast.error(data.erreur ?? "Les questions n'ont pas pu être générées.");
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setGeneration(false);
    }
  }

  if (!profil || edition) {
    return <Formulaire m={m} initial={profil ?? null} onValider={enregistrer} onAnnuler={profil ? () => setEdition(false) : undefined} />;
  }

  const etapes = etapesModule(m, {
    profil,
    sessions: Array.from({ length: sessionsModule }, (_, i) => ({ id: String(i), startedAt: "", durationMs: 0, transcript: "", wordCount: 0, mode: m.id })),
    questionsGenerees: questions !== null,
  });
  const faites = etapes.filter((e) => e.faite).length;
  const pct = Math.round((faites / etapes.length) * 100);
  const jours = profil.date ? joursEntre(dateDuJour(), profil.date) : null;
  const niveau = pct >= 80 ? "pret" : pct >= 40 ? "encours" : "debut";
  const titreProfil = m.champs.filter((c) => c.type === "text").map((c) => profil.champs[c.id]).filter(Boolean).join(" · ");

  return (
    <div className="entretien">
      <section className="card parcours" id="profil">
        <div className="parcours-head">
          <div>
            <div className="parcours-sur">{titreProfil || m.nom}</div>
            <h2 className="parcours-titre">
              {jours === null ? `Prépare ton ${m.nom.toLowerCase()}` : jours < 0 ? "C'est passé — bravo !" : jours === 0 ? "C'est aujourd'hui." : jours === 1 ? "C'est demain." : `Dans ${jours} jours`}
            </h2>
            {profil.date && jours !== null && jours >= 0 && <p className="session-meta">{dateLongue(profil.date)}</p>}
          </div>
          {jours !== null && jours >= 0 && <div className={`jmoins jmoins-${niveau}`}>J-{jours}</div>}
        </div>
        <div className="jauge" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Préparation">
          <div className={`jauge-barre jauge-${niveau}`} style={{ width: `${pct}%` }} />
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
                <Link href={e.href} className="btn small etape-action">
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
          <Link href={`/app/m/${m.id}/simulation`} className="link-btn">
            Lancer la simulation →
          </Link>
          {profil.date && (
            <button
              className="link-btn"
              onClick={() =>
                telechargerIcs({ titre: `${m.nom} — ${titreProfil || m.nom}`, date: profil.date!, description: "Préparé avec SoutenanceCoach.", url: `https://soutenance-coach.vercel.app/app/m/${m.id}` })
              }
            >
              <Icone nom="calendrier" /> Ajouter au calendrier
            </button>
          )}
        </div>
      </section>

      {jours !== null && jours < 0 && (
        <section className="card">
          <h2 className="list-title" style={{ marginTop: 0 }}>C&apos;est passé</h2>
          <RetourOralForm type={m.id} ecoleInitiale={titreProfil} />
        </section>
      )}

      <RepeterAvecAmi
        titre={`${m.nom} — ${titreProfil || m.nom}`}
        persona={m.persona}
        dureeS={60}
        cle={`sc.amis.${m.id}`}
        questions={[...(questions ?? []), ...questionsClassiquesModule(m)].slice(0, 8).map((q) => ({ question: q.question, pourquoi: q.pourquoi, attendu: q.attendu }))}
      />

      <section id="questions">
        <div className="list-head">
          <h2 className="list-title">Les questions de ce {m.persona.toLowerCase()}</h2>
          <button className="btn small primary" onClick={() => void generer()} disabled={generation}>
            {generation ? "Le jury lit ton dossier…" : questions ? <><Icone nom="rafraichir" /> Régénérer</> : <><Icone nom="etincelles" /> Générer depuis mon dossier</>}
          </button>
        </div>
        {!questions ? (
          <div className="ia-invite">
            <h2>Des questions sur ton projet, pas sur n&apos;importe lequel</h2>
            <p>Le {m.persona.toLowerCase()} IA lit ta description et ton dossier, repère les chiffres à prouver et les zones floues, et prépare dix questions — avec ce qu&apos;il vérifie et ce qu&apos;une bonne réponse contient.</p>
            <p className="dropzone-note reassure-note">Seul le texte est envoyé — jamais le fichier.</p>
          </div>
        ) : (
          questions.map((q) => <QuestionCarte key={q.id} q={q} />)
        )}
        <details className="classiques">
          <summary>Les {m.banque.length} questions classiques d&apos;un {m.persona.toLowerCase()} — avec ce qu&apos;une bonne réponse contient</summary>
          {questionsClassiquesModule(m).map((q) => (
            <QuestionCarte key={q.id} q={q} />
          ))}
        </details>
      </section>
    </div>
  );
}

function QuestionCarte({ q }: { q: QuestionEntretien }) {
  return (
    <article className={`card question${q.source === "ia" ? " question-priorite" : ""}`}>
      <span className="question-cat">{LIBELLES_CATEGORIES_ENTRETIEN[q.categorie]}</span>
      <p className="question-texte">{q.question}</p>
      <p className="question-pourquoi">
        <b>Ce qu&apos;il vérifie :</b> {q.pourquoi}
      </p>
      <p className="question-pourquoi">
        <b>Une bonne réponse :</b> {q.attendu}
      </p>
    </article>
  );
}

function Formulaire({ m, initial, onValider, onAnnuler }: { m: ModuleOral; initial: ProfilModule | null; onValider: (p: ProfilModule) => void; onAnnuler?: () => void }) {
  const [champs, setChamps] = useState<Record<string, string>>(() => Object.fromEntries(m.champs.map((c) => [c.id, initial?.champs[c.id] ?? ""])));
  const [date, setDate] = useState(initial?.date ?? "");
  const [documentTexte, setDocumentTexte] = useState(initial?.documentTexte ?? "");
  const [documentNom, setDocumentNom] = useState(initial?.documentNom ?? "");
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const requisOk = m.champs.filter((c) => c.requis).every((c) => (champs[c.id] ?? "").trim() !== "");
  const contenuOk = documentTexte.trim() !== "" || m.champs.some((c) => c.type === "textarea" && (champs[c.id] ?? "").trim() !== "");
  const valide = requisOk && contenuOk;

  async function lireDocument(file: File) {
    setLecture(true);
    setErreur(null);
    try {
      const deck = await extraireDeckPDF(file);
      const texte = deck.slides.map((s) => s.texte).join("\n");
      if (texte.trim().length < 50) throw new ExtractionError("Ce PDF ne contient pas de texte lisible (document scanné ?). Exporte-le en PDF texte.");
      setDocumentTexte(texte);
      setDocumentNom(file.name);
    } catch (e) {
      setErreur(e instanceof ExtractionError ? e.message : "Le document n'a pas pu être lu.");
    } finally {
      setLecture(false);
    }
  }

  return (
    <section className="card parcours parcours-form" aria-label={m.nom}>
      <h2 className="parcours-titre">
        <Icone nom={m.id} /> {m.nom} — {m.description}
      </h2>
      <p className="parcours-lead">Décris ton projet et dépose ton dossier : questions, simulation et avis du coach seront personnalisés à partir de là. Le PDF est lu dans ton navigateur ; seul son texte est conservé.</p>
      <form
        className="parcours-champs"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!valide) return;
          onValider({
            module: m.id,
            champs: Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, v.trim()])),
            documentTexte,
            documentNom: documentNom || undefined,
            date: date || undefined,
            etapesFaites: initial?.etapesFaites ?? {},
            misAJourLe: new Date().toISOString(),
          });
        }}
      >
        <div className="champs-ligne">
          {m.champs
            .filter((c) => c.type === "text")
            .map((c) => (
              <label key={c.id} className="champ">
                <span>{c.label}</span>
                <input value={champs[c.id] ?? ""} onChange={(e) => setChamps({ ...champs, [c.id]: e.target.value })} placeholder={c.placeholder} required={c.requis} />
              </label>
            ))}
          <label className="champ">
            <span>{m.dateLabel}</span>
            <input type="date" value={date} min={dateDuJour()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        {m.champs
          .filter((c) => c.type === "textarea")
          .map((c) => (
            <label key={c.id} className="champ champ-large">
              <span>{c.label}</span>
              <textarea value={champs[c.id] ?? ""} onChange={(e) => setChamps({ ...champs, [c.id]: e.target.value })} rows={7} placeholder={c.placeholder} />
            </label>
          ))}
        <div className="champ champ-large">
          <span>{m.documentLabel}</span>
          <div className="cv-ligne">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void lireDocument(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()} disabled={lecture}>
              {lecture ? "Lecture…" : documentNom ? "Changer de document" : "Choisir un PDF"}
            </button>
            {documentNom && (
              <span className="session-meta">
                ✓ {documentNom} · {documentTexte.split(/\s+/).length} mots lus
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
            {initial ? "Mettre à jour" : "Préparer mon oral"}
          </button>
        </div>
        {!valide && <p className="report-note">Il faut le champ obligatoire, et au moins la description ou le dossier.</p>}
      </form>
    </section>
  );
}
