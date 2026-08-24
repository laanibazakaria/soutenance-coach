"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icone, IconeBadge } from "@/app/components/Icone";
import { useToast } from "@/app/components/Toast";
import { extraireDeck, ExtractionError } from "@/lib/slides/extract";
import { sauverDeck, listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { estRapport, LIMITES_RAPPORT, type Rapport } from "@/lib/rapport";
import { lireCandidature } from "@/lib/entretien/persistance";
import { lireProfil } from "@/lib/modules/persistance";
import { MODULES, estModuleId, type ModuleId } from "@/lib/modules";
import { lireModulesActifs, TOUS_LES_MODULES, type ModuleActif } from "@/lib/preferences";
import { pousserTout, surSynchronisation } from "@/lib/sync/client";
import { indexerMemoire, memoireIndexe } from "@/lib/memoire/client";
import { CLE_RAPPORT } from "../components/RapportView";
import ZoneDepot, { type EtatDepot } from "../components/ZoneDepot";
import type { Deck } from "@/lib/slides/types";

export const dynamic = "force-static";

/** Le mot juste : « 41 pages · 12 k mots », pas « objet enregistré ». */
function detailDeck(d: Deck): string {
  const mots = d.slides.reduce((n, s) => n + s.texte.split(/\s+/).filter(Boolean).length, 0);
  const compte = mots < 1000 ? `${mots} mots lus` : `${Math.round(mots / 100) / 10} k mots lus`;
  return `${d.slides.length} diapositive${d.slides.length > 1 ? "s" : ""} · ${compte}`;
}

/**
 * Mes documents : le seul endroit où l'on dépose ses fichiers. Avant, ils se
 * déposaient à six endroits différents — les diapositives ici, le mémoire
 * là, le CV ailleurs — et personne ne savait ce que le jury avait vraiment.
 */
export default function DocumentsPage() {
  const toast = useToast();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [actifs, setActifs] = useState<ModuleActif[]>([]);
  const [occupe, setOccupe] = useState<"deck" | "rapport" | null>(null);
  const [passages, setPassages] = useState<number | null>(null);
  const [autres, setAutres] = useState<{ entretien: boolean; modules: Record<string, boolean> }>({ entretien: false, modules: {} });
  const monte = useRef(true);

  useEffect(() => {
    const lire = () => {
      const st = window.localStorage;
      setDeck(listeDeckSauvegarde(st));
      const r = lireCache<unknown>(st, CLE_RAPPORT);
      setRapport(estRapport(r) ? r : null);
      setActifs(lireModulesActifs(st) ?? ["soutenance"]);
      const mods: Record<string, boolean> = {};
      for (const m of ["pitch", "concours"] as ModuleId[]) {
        const p = estModuleId(m) ? lireProfil(st, m) : null;
        mods[m] = Boolean(p && (p.documentTexte.trim() || Object.values(p.champs).some((v) => v.trim())));
      }
      setAutres({ entretien: Boolean(lireCandidature(st)), modules: mods });
    };
    lire();
    void memoireIndexe().then((i) => monte.current && setPassages(i?.passages.length ?? null));
    return surSynchronisation(lire);
  }, []);

  async function deposerDeck(file: File) {
    setOccupe("deck");
    try {
      const d = await extraireDeck(file);
      sauverDeck(window.localStorage, d);
      setDeck(d);
      void pousserTout();
      toast.success(`${d.slides.length} diapositives lues. Seul le texte est conservé.`);
    } catch (e) {
      toast.error(e instanceof ExtractionError ? e.message : "Ce fichier n'a pas pu être lu.");
    } finally {
      setOccupe(null);
    }
  }

  async function deposerRapport(file: File) {
    setOccupe("rapport");
    try {
      const d = await extraireDeck(file);
      const texte = d.slides.map((s) => s.texte).join("\n\n").slice(0, LIMITES_RAPPORT.texteChars);
      if (d.slides.length < LIMITES_RAPPORT.pagesMin || texte.trim().length < 500) {
        throw new ExtractionError("Ce document est trop court ou sans texte lisible (scanné ?). Dépose la version texte.");
      }
      const r: Rapport = { nomFichier: file.name, pages: d.slides.length, texte, misAJourLe: new Date().toISOString() };
      ecrireCache(window.localStorage, CLE_RAPPORT, r);
      setRapport(r);
      void pousserTout();
      toast.success(`${d.slides.length} pages lues. Le jury les lira avant l'appel.`);
      const idx = await indexerMemoire(texte, file.name, undefined, d.slides.map((s) => s.texte));
      if (idx.ok) setPassages(idx.passages);
    } catch (e) {
      toast.error(e instanceof ExtractionError ? e.message : "Ce document n'a pas pu être lu.");
    } finally {
      setOccupe(null);
    }
  }

  const etatDeck: EtatDepot | null = deck ? { nomFichier: deck.nomFichier, detail: detailDeck(deck) } : null;
  const etatRapport: EtatDepot | null = rapport
    ? { nomFichier: rapport.nomFichier, detail: `${rapport.pages} pages${passages ? ` · ${passages} passages indexés` : ""}` }
    : null;
  const prets = [etatDeck, etatRapport].filter(Boolean).length;

  return (
    <div className="documents">
      <section className="card documents-etat">
        <IconeBadge nom={prets === 2 ? "valide" : prets === 1 ? "alerte" : "memoire"} teinte={prets === 2 ? "vert" : prets === 1 ? "or" : "gris"} taille={44} rond />
        <div>
          <h2 className="list-title" style={{ margin: 0 }}>
            {prets === 2 ? "Le jury a tout ce qu'il lui faut" : prets === 1 ? "Il manque une pièce" : "Commence par déposer tes documents"}
          </h2>
          <p className="session-meta">
            {prets === 2
              ? "Diapositives et mémoire déposés. Le jury les lit en entier avant de t'interroger."
              : "Le jury lit ce que tu déposes, ligne à ligne, avant l'appel — c'est de là que viennent ses questions."}
          </p>
        </div>
        {prets > 0 && (
          <Link href="/app/appel?mode=soutenance" className={`btn${prets === 2 ? " primary" : ""}`}>
            <Icone nom="appel" /> Lancer l&apos;appel
          </Link>
        )}
      </section>

      <h2 className="list-title">
        <Icone nom="soutenance" taille={18} /> Ta soutenance
      </h2>
      <ZoneDepot
        titre="Tes diapositives"
        aquoiCaSert="PDF ou PowerPoint. Le jury s'en sert pour suivre ton plan et repérer ce que tu annonces."
        icone="slides"
        etat={etatDeck}
        occupe={occupe === "deck"}
        onFichier={(f) => void deposerDeck(f)}
      />
      <ZoneDepot
        titre="Ton mémoire, ton rapport, ta thèse"
        aquoiCaSert="PDF ou PowerPoint. C'est le document que le rapporteur lit de près : ses questions de fond en viennent."
        icone="memoire"
        etat={etatRapport}
        occupe={occupe === "rapport"}
        onFichier={(f) => void deposerRapport(f)}
      />
      <p className="report-note" style={{ textAlign: "left" }}>
        Tout est lu dans ton navigateur : seul le texte est conservé, jamais le fichier. Tu peux remplacer un document à tout moment — le jury relira.
      </p>

      {actifs.filter((m) => m !== "soutenance").length > 0 && (
        <>
          <h2 className="list-title" style={{ marginTop: 26 }}>
            <Icone nom="fiches" taille={18} /> Tes autres oraux
          </h2>
          <div className="documents-autres">
            {actifs
              .filter((m) => m !== "soutenance")
              .map((m) => {
                const info = TOUS_LES_MODULES.find((x) => x.id === m);
                const rempli = m === "entretien" ? autres.entretien : Boolean(autres.modules[m]);
                const lien = m === "entretien" ? "/app/entretien" : `/app/m/${m}`;
                return (
                  <Link key={m} href={lien} className="card documents-lien card-hover">
                    <IconeBadge nom={rempli ? "valide" : "alerte"} teinte={rempli ? "vert" : "or"} taille={32} />
                    <span>
                      <b>{info?.nom ?? m}</b>
                      <small>{rempli ? "Dossier renseigné" : m === "entretien" ? "CV et offre à renseigner" : `${MODULES[m as ModuleId]?.nom ?? m} : dossier à renseigner`}</small>
                    </span>
                    <Icone nom="chevronDroite" taille={16} />
                  </Link>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
