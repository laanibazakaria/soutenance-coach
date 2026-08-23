"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache, ecrireCache, cleCache } from "@/lib/ia-cache";
import { dateDuJour } from "@/lib/parcours";
import { fichesDues, reviser, bilan, LIBELLES_TYPE, NIVEAU_ACQUIS, type Fiche, type EtatFiche } from "@/lib/fiches";
import type { Deck } from "@/lib/slides/types";
import { pousserTout } from "@/lib/sync/client";

type Mode = "revision" | "liste";

/**
 * Les fiches à mémoriser : générées depuis le support, révisées en
 * « je savais / je ne savais pas », avec rappel espacé des fiches ratées.
 * La progression est stockée avec les résultats IA et synchronisée.
 */
export default function FichesPage() {
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [etats, setEtats] = useState<Record<string, EtatFiche>>({});
  const [mode, setMode] = useState<Mode>("revision");
  const [fileDuJour, setFileDuJour] = useState<Fiche[]>([]);
  const [retourne, setRetourne] = useState(false);
  const [faitesCetteSeance, setFaitesCetteSeance] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const aujourdhui = dateDuJour();
  // Geste mobile : glisser la fiche retournée à droite (je savais) ou à gauche (je ne savais pas).
  const [dx, setDx] = useState(0);
  const dragRef = useRef({ x0: 0, actif: false });

  useEffect(() => {
    const d = listeDeckSauvegarde(window.localStorage);
    setDeck(d);
    if (!d) return;
    const textes = d.slides.map((s) => s.texte);
    const f = lireCache<Fiche[]>(window.localStorage, cleCache("fiches", textes));
    const e = lireCache<Record<string, EtatFiche>>(window.localStorage, cleCache("fiches-etats", textes)) ?? {};
    setFiches(f);
    setEtats(e);
    if (f) {
      const dues = fichesDues(f, e, dateDuJour());
      setFileDuJour(dues);
      setMode(dues.length > 0 ? "revision" : "liste");
    }
  }, []);

  if (deck === undefined) return null;

  if (!deck) {
    return (
      <div className="ia-invite">
        <h2>🗂️ Fiches à mémoriser</h2>
        <p>Dépose d&apos;abord ton support : les fiches sont tirées de tes diapositives — tes chiffres, tes définitions, tes choix à justifier.</p>
        <Link href="/app/slides" className="btn primary">
          📄 Déposer mes slides
        </Link>
      </div>
    );
  }

  const textes = deck.slides.map((s) => s.texte);

  async function generer() {
    if (!deck) return;
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch("/api/fiches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slides: deck.slides.map((s) => ({ numero: s.numero, titre: s.titre, texte: s.texte })) }),
      });
      const data = (await res.json()) as { fiches?: Fiche[]; erreur?: string };
      if (res.ok && data.fiches) {
        ecrireCache(window.localStorage, cleCache("fiches", textes), data.fiches);
        setFiches(data.fiches);
        // La progression des fiches identiques (même recto) est conservée.
        const dues = fichesDues(data.fiches, etats, aujourdhui);
        setFileDuJour(dues);
        setMode("revision");
        setRetourne(false);
        void pousserTout();
      } else {
        setErreur(data.erreur ?? "Les fiches n'ont pas pu être générées.");
      }
    } catch {
      setErreur("Le serveur est injoignable.");
    } finally {
      setChargement(false);
    }
  }

  function repondre(resultat: "su" | "pas-su") {
    const courante = fileDuJour[0];
    if (!courante) return;
    const suivants = { ...etats, [courante.id]: reviser(etats[courante.id], resultat, aujourdhui) };
    setEtats(suivants);
    ecrireCache(window.localStorage, cleCache("fiches-etats", textes), suivants);
    void pousserTout();
    setFaitesCetteSeance((n) => n + 1);
    setRetourne(false);
    // Une fiche ratée revient en fin de file : on la revoit dans la même séance.
    const reste = fileDuJour.slice(1);
    setFileDuJour(resultat === "pas-su" ? [...reste, courante] : reste);
  }

  if (!fiches) {
    return (
      <div className="ia-invite">
        <h2>🗂️ Fiches à mémoriser</h2>
        <p>
          Le coach extrait de <b>{deck.nomFichier}</b> ce que tu dois savoir par cœur : chiffres clés, définitions, choix à justifier,
          questions pièges. Puis tu les révises — les ratées reviennent plus souvent.
        </p>
        <button className="btn primary big" onClick={() => void generer()} disabled={chargement}>
          {chargement ? "Le coach lit tes slides…" : "✨ Générer mes fiches"}
        </button>
        {erreur && (
          <p className="warn" role="alert" style={{ marginTop: 16 }}>
            {erreur}
          </p>
        )}
        <p className="dropzone-note reassure-note">Seul le texte de tes diapositives est envoyé — jamais le fichier.</p>
      </div>
    );
  }

  const b = bilan(fiches, etats, aujourdhui);
  const courante = fileDuJour[0];

  return (
    <div className="fiches">
      <div className="toolbar">
        <div>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {b.total} fiches · <b>{b.dues} à revoir</b> · {b.acquises} acquise{b.acquises > 1 ? "s" : ""}
            {b.nouvelles > 0 && ` · ${b.nouvelles} jamais vue${b.nouvelles > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="tabs fiches-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "revision"} className={`tab${mode === "revision" ? " active" : ""}`} onClick={() => setMode("revision")}>
            Réviser
          </button>
          <button role="tab" aria-selected={mode === "liste"} className={`tab${mode === "liste" ? " active" : ""}`} onClick={() => setMode("liste")}>
            Toutes les fiches
          </button>
        </div>
      </div>

      {mode === "revision" &&
        (courante ? (
          <div className="fiche-scene">
            <p className="fiche-progress">
              {fileDuJour.length} restante{fileDuJour.length > 1 ? "s" : ""} · {faitesCetteSeance} faite{faitesCetteSeance > 1 ? "s" : ""} cette séance
            </p>
            <div
              className={`card fiche fiche-${courante.type}${dx > 60 ? " fiche-oui" : dx < -60 ? " fiche-non" : ""}`}
              style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined, transition: dx ? "none" : "transform 0.2s ease" }}
              onPointerDown={(e) => {
                if (!retourne || (e.target as HTMLElement).closest("button")) return;
                dragRef.current = { x0: e.clientX, actif: true };
              }}
              onPointerMove={(e) => {
                if (dragRef.current.actif) setDx(e.clientX - dragRef.current.x0);
              }}
              onPointerUp={() => {
                if (!dragRef.current.actif) return;
                dragRef.current.actif = false;
                const d = dx;
                setDx(0);
                if (d > 120) repondre("su");
                else if (d < -120) repondre("pas-su");
              }}
              onPointerCancel={() => {
                dragRef.current.actif = false;
                setDx(0);
              }}
            >
              <span className="question-cat">
                {LIBELLES_TYPE[courante.type]}
                {courante.slide > 0 && ` · diapositive ${courante.slide}`}
                {(etats[courante.id]?.ratees ?? 0) > 0 && " · déjà ratée"}
              </span>
              <p className="fiche-recto">{courante.recto}</p>
              {retourne ? (
                <>
                  <p className="fiche-verso">{courante.verso}</p>
                  <div className="actions fiche-actions">
                    <button className="btn danger" onClick={() => repondre("pas-su")}>
                      ✗ Je ne savais pas
                    </button>
                    <button className="btn primary" onClick={() => repondre("su")}>
                      ✓ Je savais
                    </button>
                  </div>
                </>
              ) : (
                <div className="actions fiche-actions">
                  <button className="btn primary" onClick={() => setRetourne(true)}>
                    Voir la réponse
                  </button>
                </div>
              )}
            </div>
            <p className="report-note">
              {retourne ? "Glisse la fiche à droite si tu savais, à gauche sinon — ou utilise les boutons." : "Réponds à voix haute avant de retourner la fiche — c'est comme ça que le jury t'entendra."}
            </p>
          </div>
        ) : (
          <div className="card teaser fiches-fin">
            {faitesCetteSeance > 0 ? (
              <>
                ✅ Séance terminée : {faitesCetteSeance} fiche{faitesCetteSeance > 1 ? "s" : ""} revue{faitesCetteSeance > 1 ? "s" : ""}.
                {b.acquises === b.total ? " Tout est acquis." : " Les ratées reviendront demain."}
              </>
            ) : (
              <>✅ Rien à revoir aujourd&apos;hui. Reviens demain — ou relis toutes les fiches.</>
            )}
          </div>
        ))}

      {mode === "liste" && (
        <>
          {b.difficiles.length > 0 && (
            <div className="card question question-priorite fiches-difficiles">
              <span className="question-cat">Tes fiches difficiles</span>
              <ul>
                {b.difficiles.map((f) => (
                  <li key={f.id}>
                    {f.recto} <span className="session-meta">· ratée {etats[f.id]?.ratees} fois</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(["chiffre", "definition", "choix", "piege"] as const).map((type) => {
            const groupe = fiches.filter((f) => f.type === type);
            if (groupe.length === 0) return null;
            return (
              <section key={type} className="fiches-groupe">
                <h2 className="list-title">{LIBELLES_TYPE[type]}s</h2>
                {groupe.map((f) => {
                  const e = etats[f.id];
                  const niveau = e?.niveau ?? 0;
                  return (
                    <div key={f.id} className={`card fiche-ligne${niveau >= NIVEAU_ACQUIS ? " fiche-acquise" : ""}`}>
                      <div className="fiche-ligne-corps">
                        <b>{f.recto}</b>
                        <p>{f.verso}</p>
                      </div>
                      <div className="fiche-niveau" aria-label={`Niveau ${niveau}`} title={e ? `${e.vues} vue(s), ${e.ratees} ratée(s)` : "jamais vue"}>
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={`fiche-point${niveau >= n ? " on" : ""}`} />
                        ))}
                        {f.slide > 0 && <span className="question-slide">diapo {f.slide}</span>}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
          <div className="actions" style={{ marginTop: 24 }}>
            <button className="btn small" onClick={() => void generer()} disabled={chargement}>
              {chargement ? "Génération…" : "↻ Régénérer les fiches"}
            </button>
          </div>
          {erreur && (
            <p className="warn" role="alert">
              {erreur}
            </p>
          )}
        </>
      )}
    </div>
  );
}
