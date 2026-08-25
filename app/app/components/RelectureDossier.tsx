"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icone, IconeBadge } from "@/app/components/Icone";
import { useToast } from "@/app/components/Toast";
import { cleCache, lireCache, ecrireCache } from "@/lib/ia-cache";
import { signalerAppelIa } from "@/lib/usage-client";
import { trierIncoherences, type Relecture } from "@/lib/dossier/relecture";
import type { Deck } from "@/lib/slides/types";
import type { Rapport } from "@/lib/rapport";
import type { Pitch } from "@/lib/pitch";

interface Resultat {
  relecture: Relecture;
  portee: string;
}

/**
 * La relecture du dossier, sur la page où l'on dépose.
 *
 * Jusqu'ici, déposer ne produisait rien de visible : il fallait aller chercher
 * l'analyse, le pitch et les questions sur trois pages différentes, et aucune
 * des trois ne voyait les deux documents à la fois. Ici, un seul geste — et le
 * candidat lit ce que le jury comprendra de son travail.
 */
export default function RelectureDossier({ deck, rapport, dureeMin = 15 }: { deck: Deck; rapport: Rapport; dureeMin?: number }) {
  const toast = useToast();
  const [res, setRes] = useState<Resultat | null>(null);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [encours, setEncours] = useState<"relecture" | "pitch" | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const textes = deck.slides.map((s) => s.texte);
  const cleRelecture = cleCache("relecture", textes, rapport.texte.slice(0, 2000));
  const clePitch = cleCache("pitch", textes, String(dureeMin));

  useEffect(() => {
    const st = window.localStorage;
    setRes(lireCache<Resultat>(st, cleRelecture));
    setPitch(lireCache<Pitch>(st, clePitch));
  }, [cleRelecture, clePitch]);

  async function relire() {
    setEncours("relecture");
    try {
      const r = await fetch("/api/dossier/relecture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slides: deck.slides, nomFichier: deck.nomFichier, rapport: rapport.texte }),
      });
      const j = (await r.json()) as Partial<Resultat> & { erreur?: string };
      if (!r.ok || !j.relecture) throw new Error(j.erreur ?? "La relecture a échoué.");
      const resultat: Resultat = { relecture: j.relecture, portee: j.portee ?? "" };
      ecrireCache(window.localStorage, cleRelecture, resultat);
      setRes(resultat);
      setOuvert(true);
      signalerAppelIa();
      const n = j.relecture.incoherences.length;
      toast.success(n === 0 ? "Aucune contradiction entre tes deux documents." : `${n} écart${n > 1 ? "s" : ""} relevé${n > 1 ? "s" : ""} entre ta présentation et ton rapport.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le serveur est injoignable.");
      setEncours(null);
      return;
    }
    // Le pitch enchaîne : c'est le second appel annoncé sur le bouton.
    if (!lireCache<Pitch>(window.localStorage, clePitch)) {
      setEncours("pitch");
      try {
        const r = await fetch("/api/pitch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slides: deck.slides, nomFichier: deck.nomFichier, dureeMinutes: dureeMin }),
        });
        const j = (await r.json()) as { pitch?: Pitch; erreur?: string };
        if (r.ok && j.pitch) {
          ecrireCache(window.localStorage, clePitch, j.pitch);
          setPitch(j.pitch);
          signalerAppelIa();
        }
      } catch {
        // Le pitch a sa page dédiée : son échec ne doit pas effacer la relecture.
      }
    }
    setEncours(null);
  }

  if (!res) {
    return (
      <section className="card relecture-invite">
        <IconeBadge nom="etincelles" taille={44} rond />
        <div>
          <h2 className="list-title" style={{ margin: 0 }}>Fais relire ton dossier</h2>
          <p className="session-meta">
            Un rapporteur commence par confronter ta présentation à ton rapport. C&apos;est le seul
            endroit où les deux sont lus ensemble : ce que le jury comprendra, les contradictions
            entre les deux documents, et les questions auxquelles tu ne réponds nulle part.
          </p>
        </div>
        <button className="btn primary" onClick={() => void relire()} disabled={encours !== null}>
          {encours === "relecture" ? "Le rapporteur lit…" : encours === "pitch" ? "Rédaction du pitch…" : <><Icone nom="etincelles" /> Faire relire mon dossier</>}
        </button>
        <p className="report-note a-gauche" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
          Deux appels IA sur ton quota : la relecture, puis le script de ton exposé.
        </p>
      </section>
    );
  }

  const { compris, manques } = res.relecture;
  const incoherences = trierIncoherences(res.relecture.incoherences);
  const graves = incoherences.filter((i) => i.gravite === "haute").length;

  return (
    <section className="card relecture">
      <div className="relecture-tete">
        <IconeBadge nom={graves > 0 ? "alerte" : "valide"} teinte={graves > 0 ? "or" : "vert"} taille={40} rond />
        <div>
          <h2 className="list-title" style={{ margin: 0 }}>
            {incoherences.length === 0
              ? "Tes deux documents se tiennent"
              : `${incoherences.length} écart${incoherences.length > 1 ? "s" : ""} entre ta présentation et ton rapport`}
          </h2>
          <p className="session-meta">{res.portee}</p>
        </div>
        <button className="btn small" onClick={() => void relire()} disabled={encours !== null}>
          {encours ? "En cours…" : <><Icone nom="rafraichir" /> Relire</>}
        </button>
      </div>

      <div className="relecture-compris">
        <h3>Ce que le jury comprendra de ton travail</h3>
        <p className="report-note a-gauche" style={{ marginTop: 0 }}>
          Si l&apos;une de ces quatre lignes est fausse, ton dossier est ambigu — pas le jury.
        </p>
        <dl>
          <div><dt>Sujet</dt><dd>{compris.sujet || "—"}</dd></div>
          <div><dt>Problématique</dt><dd>{compris.problematique || "—"}</dd></div>
          <div><dt>Méthode</dt><dd>{compris.methode || "—"}</dd></div>
          <div><dt>Résultats</dt><dd>{compris.resultats || "—"}</dd></div>
        </dl>
      </div>

      {incoherences.length > 0 && (
        <div className="relecture-ecarts">
          <h3>Ce qui ne concorde pas</h3>
          {incoherences.map((i, n) => (
            <article key={n} className={`ecart ecart-${i.gravite}`}>
              <b>{i.quoi}</b>
              <div className="ecart-cotes">
                <span><em>Ta présentation</em>{i.presentation}</span>
                <span><em>Ton rapport</em>{i.rapport}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {manques.length > 0 && (
        <div className="relecture-manques">
          <h3>Ce à quoi ton dossier ne répond pas</h3>
          <ul>
            {manques.map((m, n) => (
              <li key={n}>
                <b>{m.question}</b>
                {m.pourquoi && <small>{m.pourquoi}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pitch && (
        <div className="relecture-pitch">
          <button className="link-btn" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
            {ouvert ? "Masquer" : "Voir"} le script de ton exposé ({dureeMin} min) {ouvert ? "▾" : "▸"}
          </button>
          {ouvert && (
            <>
              <p className="pitch-accroche">{pitch.accroche}</p>
              <p className="report-note a-gauche">
                Le script complet, minuté diapositive par diapositive, est sur{" "}
                <Link href="/app/slides">la page de ton support</Link> — tu peux y changer la durée.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
