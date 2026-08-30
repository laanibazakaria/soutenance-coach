"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { listSessions } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";
import { TOUS_LES_MODULES, lireModulesActifs, resumerModules, type ModuleActif, type ResumeModule } from "@/lib/preferences";
import { oralActif, listeOraux } from "@/lib/oraux";
import { surSynchronisation } from "@/lib/sync/client";
import { lireCache } from "@/lib/ia-cache";
import { lireCandidature } from "@/lib/entretien/persistance";
import type { Serie } from "@/lib/quotidien";
import { chiffresSemaine, dateLongue, salutation } from "@/lib/accueil";
import { useUsage } from "@/lib/usage-client";
import { Icone, IconeBadge, type NomIcone } from "@/app/components/Icone";
import CarteQuotidien from "./components/CarteQuotidien";
import ParcoursSimple from "./components/ParcoursSimple";
import LigneSession from "./components/LigneSession";
import EtatVide from "@/app/components/EtatVide";

/** L'accueil : ce que tu prépares, où tu en es, quoi faire maintenant. */
export default function AccueilPage() {
  return (
    <Suspense fallback={null}>
      <AccueilInner />
    </Suspense>
  );
}

function AccueilInner() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [actifs, setActifs] = useState<ModuleActif[] | null | undefined>(undefined);
  const [resumes, setResumes] = useState<ResumeModule[]>([]);
  const [serie, setSerie] = useState<Serie | null>(null);
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  const [entretienPret, setEntretienPret] = useState(false);
  const { data: session } = useSession();
  const usage = useUsage();

  useEffect(() => {
    const lire = () => {
      const s = listSessions(window.localStorage);
      const a = lireModulesActifs(window.localStorage);
      setSessions(s);
      setActifs(a);
      const oral = oralActif(window.localStorage);
      // La carte porte le nom du dossier (« Ma soutenance de PFA »), pas le
      // type générique — c'est le dossier qu'on continue, pas une catégorie.
      setResumes((a ? resumerModules(window.localStorage, s, a) : []).map((r) => (oral && r.id === oral.type ? { ...r, nom: oral.nom } : r)));
      setSerie(lireCache<Serie>(window.localStorage, "serie"));
      setMaintenant(new Date());
      // Le jury n'interroge pas à l'aveugle : sans dossier, l'appel refuse. Autant
      setEntretienPret(lireCandidature(window.localStorage) !== null);
    };
    lire();
    return surSynchronisation(lire);
  }, []);
  // Pas encore d'oral : la seule porte d'entrée est d'en créer un, nommé.
  useEffect(() => {
    if (actifs === null) window.location.replace("/app/oraux");
  }, [actifs]);

  if (actifs === undefined || actifs === null || sessions === null || maintenant === null) return null;

  const inactifs = TOUS_LES_MODULES.filter((m) => !actifs.includes(m.id));
  const recentes = sessions.slice(0, 4);
  const urgent = [...resumes].filter((r) => r.jours !== null && r.jours >= 0).sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0))[0];
  const premierSansDate = resumes.find((r) => r.jours === null);
  const chiffres = chiffresSemaine(sessions, serie, maintenant);
  const nbOraux = typeof window !== "undefined" ? listeOraux(window.localStorage).length : 0;
  const prenom = session?.user?.name?.split(" ")[0];
  const deltaSessions = chiffres.sessions - chiffres.sessionsSemainePrecedente;
  const ratioIa = usage && usage.limite > 0 ? Math.min(100, Math.round((usage.appels / usage.limite) * 100)) : 0;

  return (
    <div className="accueil">
      <div className="accueil-tete">
        <h1 className="accueil-bonjour">
          {salutation(maintenant)}
          {prenom ? ` ${prenom}` : ""}
        </h1>
        <p className="accueil-date">{dateLongue(maintenant)}</p>
      </div>

      {actifs?.includes("soutenance") && <ParcoursSimple />}

      <div className="accueil-duo">
        <section className="card accueil-echeance" aria-label="Prochaine échéance">
          <h2 className="carte-titre carte-titre-clair">
            <Icone nom="calendrier" taille={16} /> Prochaine échéance
          </h2>
          {urgent ? (
            <>
              <div className="accueil-echeance-corps">
                <div>
                  <h2>
                    {urgent.nom} · {urgent.jours === 0 ? "aujourd'hui" : urgent.jours === 1 ? "demain" : `dans ${urgent.jours} jours`}
                  </h2>
                  <p>{urgent.sousTitre}</p>
                </div>
                <span className="accueil-echeance-j">J-{urgent.jours}</span>
              </div>
              <div className="accueil-echeance-actions">
                <Link href={urgent.prochaineAction.lien} className="btn accueil-btn-clair">
                  {urgent.prochaineAction.titre} →
                </Link>
                {urgent.pourcent !== null && <span className="accueil-echeance-pret">Prêt à {urgent.pourcent} %</span>}
              </div>
            </>
          ) : (
            <>
              <div className="accueil-echeance-corps">
                <div>
                  <h2>Aucune date pour l&apos;instant</h2>
                  <p>Donne la date de ton oral : le parcours se construit à partir d&apos;elle, jour par jour.</p>
                </div>
              </div>
              <div className="accueil-echeance-actions">
                <Link href={premierSansDate?.prochaineAction.lien ?? "/app/soutenance"} className="btn accueil-btn-clair">
                  {premierSansDate?.prochaineAction.titre ?? "Donner ma date"} →
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="card accueil-perf" aria-label="Ma progression">
          <h2 className="carte-titre">
            <Icone nom="tendance" taille={16} /> Cette semaine
          </h2>
          <div className="accueil-perf-grille">
            <div>
              <span className="accueil-perf-valeur">{chiffres.sessions}</span>
              <span className="accueil-perf-label">session{chiffres.sessions > 1 ? "s" : ""}</span>
              <span className={`accueil-perf-delta ${deltaSessions > 0 ? "plus" : deltaSessions < 0 ? "moins" : ""}`}>
                {deltaSessions > 0 ? `+${deltaSessions}` : deltaSessions < 0 ? `${deltaSessions}` : "="} vs semaine dernière
              </span>
            </div>
            <div>
              <span className="accueil-perf-valeur">{chiffres.minutes}</span>
              <span className="accueil-perf-label">min à voix haute</span>
              <span className="accueil-perf-delta">{chiffres.mots.toLocaleString("fr-FR")} mots</span>
            </div>
            <div>
              <span className="accueil-perf-valeur accueil-perf-or">{chiffres.serie}</span>
              <span className="accueil-perf-label">jour{chiffres.serie > 1 ? "s" : ""} d&apos;affilée</span>
              <span className="accueil-perf-delta">question du jour</span>
            </div>
          </div>
          <Link href="/app/bilan" className="accueil-perf-lien">
            Voir mon bilan <Icone nom="chevronDroite" taille={14} />
          </Link>
        </section>
      </div>

      <section className="card accueil-usage" aria-label="Mon utilisation ce mois">
        <div className="accueil-usage-tete">
          <span className="accueil-usage-titre">Mon utilisation ce mois</span>
          <Link href="/app/forfaits" className="accueil-usage-lien">
            Voir les forfaits →
          </Link>
        </div>
        <div className="accueil-usage-grille">
          <div className="accueil-usage-item">
            <span className="accueil-usage-ligne">
              <span>Appels IA</span>
              <b className={ratioIa >= 100 ? "rouge" : ratioIa >= 75 ? "orange" : "vert"}>{usage ? `${usage.appels} / ${usage.limite}` : "…"}</b>
            </span>
            <span className="accueil-usage-barre">
              <span style={{ width: `${ratioIa}%` }} className={ratioIa >= 100 ? "rouge" : ratioIa >= 75 ? "orange" : ""} />
            </span>
          </div>
          <div className="accueil-usage-item">
            <span className="accueil-usage-ligne">
              <span>Sessions</span>
              <b className="vert">{chiffres.sessionsMois} · illimité</b>
            </span>
            <span className="accueil-usage-barre">
              <span style={{ width: `${Math.min(100, chiffres.sessionsMois * 10)}%` }} />
            </span>
          </div>
          <div className="accueil-usage-item">
            <span className="accueil-usage-ligne">
              <span>Mes oraux</span>
              <b className="vert">{nbOraux} dossier{nbOraux > 1 ? "s" : ""}</b>
            </span>
            <span className="accueil-usage-barre">
              <span style={{ width: `${Math.min(100, nbOraux * 25)}%` }} />
            </span>
          </div>
        </div>
      </section>

      <CarteQuotidien />

      <div className="list-head">
        <h2 className="list-title">
          <Icone nom="fiches" taille={18} /> Mes oraux
        </h2>
        <Link href="/app/oraux" className="btn small">
          <Icone nom="plus" /> Ajouter un oral
        </Link>
      </div>
      <div className="accueil-grille">
        {resumes.map((r) => (
          <article key={r.id} className="card accueil-carte card-hover">
            <div className="accueil-carte-tete">
              <IconeBadge nom={r.id} teinte={r.id === "soutenance" ? "violet" : "bleu"} />
              <div>
                <h3>{r.nom}</h3>
                <p className="session-meta">{r.sousTitre}</p>
              </div>
              {r.jours !== null && r.jours >= 0 && <span className="accueil-jours">J-{r.jours}</span>}
            </div>
            {r.pourcent !== null ? (
              <>
                <div className="jauge">
                  <div className={`jauge-barre ${r.pourcent >= 80 ? "jauge-pret" : r.pourcent >= 40 ? "jauge-encours" : "jauge-debut"}`} style={{ width: `${r.pourcent}%` }} />
                </div>
                <p className="jauge-texte" style={{ marginBottom: 10 }}>
                  <b>Prêt à {r.pourcent} %</b>
                </p>
              </>
            ) : (
              <p className="accueil-vide">Pas encore commencé.</p>
            )}
            <Link href={r.prochaineAction.lien} className="btn small primary">
              {r.prochaineAction.titre} →
            </Link>
            <Link href={r.hub} className="accueil-lien-hub" aria-label={`Ouvrir le module ${r.nom}`}>
              Ouvrir le module
            </Link>
          </article>
        ))}
      </div>

      <div className="list-head">
        <h2 className="list-title">
          <Icone nom="sessions" taille={18} /> Dernières sessions
        </h2>
        <div className="list-actions">
          <Link href="/app/sessions" className="accueil-usage-lien">
            Voir tout →
          </Link>
        </div>
      </div>
      {recentes.length === 0 ? (
        <EtatVide
          icone="micro"
          titre="Ta première session : deux minutes"
          texte="Parle comme si le jury était en face. À la fin, quatre mesures calculées — pas une impression — et chaque session suivante te montre ta progression."
          action={{ libelle: "Lancer ma première session →", href: "/app/session" }}
          secondaire={
            <a href="/demo-capture.html?vers=/app">Voir l&apos;application avec un exemple rempli</a>
          }
        />
      ) : (
        <div className="lignes-sessions">
          {recentes.map((s) => (
            <LigneSession key={s.id} session={s} />
          ))}
        </div>
      )}

      <h2 className="list-title" style={{ marginTop: 30 }}>
        <Icone nom="boussole" taille={18} /> Découvrir
      </h2>
      <div className="accueil-decouvrir">
        {inactifs.map((m) => (
          <Link key={m.id} href={`/app/oraux?type=${m.id}`} className="card accueil-feature card-hover">
            <IconeBadge nom={m.id} taille={36} />
            <span>
              <b>{m.nom}</b>
              <small>{m.description} Créer un oral.</small>
            </span>
          </Link>
        ))}
        <Feature icone="document" titre="Mon bilan" texte="Une photographie de ta préparation à imprimer, ou à partager avec ton encadrant." href="/app/bilan" />
        <Feature icone="guides" titre="Les guides" texte="Un guide par oral : dix minutes à lire, cinq à relire la veille." href="/app/guides" />
      </div>

      {!actifs?.includes("soutenance") && (
      <section className="accueil-bandeau" aria-label="Appel avec le recruteur IA">
        <div>
          <span className="accueil-bandeau-titre">
            <Icone nom="appel" taille={18} /> L&apos;appel avec le recruteur IA
            <span className="accueil-nouveau">Nouveau</span>
          </span>
          <p>
            {entretienPret
              ? "Un vrai entretien en direct : la recruteuse et le manager technique ont lu ton CV et l'offre. Ils parlent, tu réponds au micro, ils rebondissent."
              : "Un vrai entretien en direct — mais le recruteur lit ton CV et l'offre avant de t'appeler. Commence par renseigner ton dossier."}
          </p>
        </div>
        <Link href={entretienPret ? "/app/appel?mode=entretien" : "/app/entretien"} className="btn accueil-bandeau-btn">
          {entretienPret ? "Lancer l'appel →" : "Renseigner mon dossier →"}
        </Link>
      </section>
      )}
    </div>
  );
}

function Feature({ icone, titre, texte, href, nouveau }: { icone: NomIcone; titre: string; texte: string; href: string; nouveau?: boolean }) {
  return (
    <Link href={href} className="card accueil-feature card-hover">
      <IconeBadge nom={icone} taille={36} />
      <span>
        <b>
          {titre}
          {nouveau && <span className="accueil-nouveau">Nouveau</span>}
        </b>
        <small>{texte}</small>
      </span>
    </Link>
  );
}
