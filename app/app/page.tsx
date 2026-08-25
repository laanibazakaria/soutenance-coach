"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { listSessions } from "@/lib/storage";
import type { SessionRecord } from "@/lib/types";
import { TOUS_LES_MODULES, lireModulesActifs, sauverModulesActifs, resumerModules, type ModuleActif, type ResumeModule } from "@/lib/preferences";
import { pousserTout, surSynchronisation, signalerSynchronisation } from "@/lib/sync/client";
import { lireCache } from "@/lib/ia-cache";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { estRapport } from "@/lib/rapport";
import { CLE_RAPPORT } from "./components/RapportView";
import type { Serie } from "@/lib/quotidien";
import { chiffresSemaine, dateLongue, salutation } from "@/lib/accueil";
import { useUsage } from "@/lib/usage-client";
import { useToast } from "@/app/components/Toast";
import { Icone, IconeBadge, type NomIcone } from "@/app/components/Icone";
import CarteQuotidien from "./components/CarteQuotidien";
import FormulaireEtudiant from "./components/FormulaireEtudiant";
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
  const params = useSearchParams();
  const choisirUrl = params.get("choisir") === "1";
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [actifs, setActifs] = useState<ModuleActif[] | null | undefined>(undefined);
  const [choisir, setChoisir] = useState(false);
  const [etapeProfil, setEtapeProfil] = useState(false);
  const [resumes, setResumes] = useState<ResumeModule[]>([]);
  const [serie, setSerie] = useState<Serie | null>(null);
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  const [dossierPret, setDossierPret] = useState(false);
  const { data: session } = useSession();
  const usage = useUsage();

  useEffect(() => {
    const lire = () => {
      const s = listSessions(window.localStorage);
      const a = lireModulesActifs(window.localStorage);
      setSessions(s);
      setActifs(a);
      setResumes(a ? resumerModules(window.localStorage, s, a) : []);
      setSerie(lireCache<Serie>(window.localStorage, "serie"));
      setMaintenant(new Date());
      // Le jury n'interroge pas à l'aveugle : sans dossier, l'appel refuse. Autant
      // que l'accueil envoie au dépôt plutôt qu'au mur.
      setDossierPret(
        listeDeckSauvegarde(window.localStorage) !== null ||
          estRapport(lireCache<unknown>(window.localStorage, CLE_RAPPORT)),
      );
    };
    lire();
    return surSynchronisation(lire);
  }, []);
  useEffect(() => setChoisir(choisirUrl), [choisirUrl]);

  if (actifs === undefined || sessions === null || maintenant === null) return null;

  function enregistrer(liste: ModuleActif[]) {
    const premiereFois = !actifs;
    sauverModulesActifs(window.localStorage, liste);
    setActifs(liste);
    setResumes(resumerModules(window.localStorage, sessions ?? [], liste));
    setChoisir(false);
    if (premiereFois) setEtapeProfil(true);
    signalerSynchronisation();
    void pousserTout();
    window.history.replaceState(null, "", "/app");
  }

  if (!actifs || choisir) {
    return <Choix initial={actifs ?? []} premiereFois={!actifs} sansSessions={sessions.length === 0} onValider={enregistrer} onAnnuler={actifs ? () => setChoisir(false) : undefined} />;
  }

  if (etapeProfil) {
    return (
      <div className="choix">
        <h2 className="onboarding-title">Fais connaissance avec ton jury</h2>
        <p className="onboarding-lead">Dis-lui d&apos;où tu parles : un jury de l&apos;ENSIAS en IA ne pose pas les mêmes questions qu&apos;un jury de médecine.</p>
        <FormulaireEtudiant onFait={() => setEtapeProfil(false)} libelleValider="C'est parti" />
      </div>
    );
  }

  const inactifs = TOUS_LES_MODULES.filter((m) => !actifs.includes(m.id));
  const recentes = sessions.slice(0, 4);
  const urgent = [...resumes].filter((r) => r.jours !== null && r.jours >= 0).sort((a, b) => (a.jours ?? 0) - (b.jours ?? 0))[0];
  const premierSansDate = resumes.find((r) => r.jours === null);
  const chiffres = chiffresSemaine(sessions, serie, maintenant);
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
              <span>Oraux préparés</span>
              <b className="vert">{resumes.length} / 4</b>
            </span>
            <span className="accueil-usage-barre">
              <span style={{ width: `${(resumes.length / 4) * 100}%` }} />
            </span>
          </div>
        </div>
      </section>

      <CarteQuotidien />

      <div className="list-head">
        <h2 className="list-title">
          <Icone nom="fiches" taille={18} /> Mes oraux
        </h2>
        <button className="btn small" onClick={() => setChoisir(true)}>
          <Icone nom="plus" /> Ajouter un oral
        </button>
      </div>
      <div className="accueil-grille">
        {resumes.map((r) => (
          <article key={r.id} className="card accueil-carte card-hover">
            <div className="accueil-carte-tete">
              <IconeBadge nom={r.id} teinte={r.id === "soutenance" ? "violet" : r.id === "entretien" ? "bleu" : r.id === "pitch" ? "or" : "rose"} />
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
          <button key={m.id} type="button" className="card accueil-feature card-hover" onClick={() => enregistrer([...actifs, m.id])}>
            <IconeBadge nom={m.id} taille={36} />
            <span>
              <b>{m.nom}</b>
              <small>{m.description} Activer le module.</small>
            </span>
          </button>
        ))}
        <Feature icone="amis" titre="Répéter avec un ami" texte="Un lien : il joue le jury sans compte, et son retour revient dans ta préparation." href={resumes[0]?.hub ?? "/app/soutenance"} />
        <Feature icone="document" titre="Mon bilan" texte="Une photographie de ta préparation à imprimer, ou à partager avec ton encadrant." href="/app/bilan" />
        <Feature icone="guides" titre="Les guides" texte="Un guide par oral : dix minutes à lire, cinq à relire la veille." href="/app/guides" />
      </div>

      <section className="accueil-bandeau" aria-label="Appel avec le jury IA">
        <div>
          <span className="accueil-bandeau-titre">
            <Icone nom="appel" taille={18} /> L&apos;appel avec le jury IA
            <span className="accueil-nouveau">Nouveau</span>
          </span>
          <p>
            {dossierPret
              ? "Un vrai oral en direct : le jury parle, tu réponds au micro, il rebondit sur ce que tu viens de dire. Puis le débrief complet — ce qui a marché, les moments manqués, le plan d'action."
              : "Un vrai oral en direct : le jury parle, tu réponds au micro, il rebondit. Mais il lit ton dossier avant de t'interroger — c'est par là qu'on commence."}
          </p>
        </div>
        <Link href={dossierPret ? "/app/appel" : "/app/documents"} className="btn accueil-bandeau-btn">
          {dossierPret ? "Lancer l'appel →" : "Déposer mon dossier →"}
        </Link>
      </section>
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

function Choix({
  initial,
  premiereFois,
  sansSessions,
  onValider,
  onAnnuler,
}: {
  initial: ModuleActif[];
  premiereFois: boolean;
  sansSessions: boolean;
  onValider: (l: ModuleActif[]) => void;
  onAnnuler?: () => void;
}) {
  const [choix, setChoix] = useState<ModuleActif[]>(initial.length ? initial : []);
  const toast = useToast();
  function basculer(id: ModuleActif) {
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }
  return (
    <div className="choix">
      <h2 className="onboarding-title">{premiereFois ? "Qu'est-ce que tu prépares ?" : "Tes oraux"}</h2>
      <p className="onboarding-lead">
        {premiereFois
          ? "Choisis un ou plusieurs oraux : l'application ne te montrera que ce qui te concerne. Tu pourras en ajouter plus tard."
          : "Ajoute ou retire un oral. Rien n'est supprimé : un module retiré garde ses données."}
      </p>
      <div className="choix-grille">
        {TOUS_LES_MODULES.map((m) => {
          const actif = choix.includes(m.id);
          return (
            <button key={m.id} type="button" className={`card choix-carte${actif ? " active" : ""}`} onClick={() => basculer(m.id)} aria-pressed={actif}>
              <IconeBadge nom={m.id} taille={44} teinte={actif ? "violet" : "gris"} />
              <b>{m.nom}</b>
              <p>{m.description}</p>
              <span className="choix-coche" aria-hidden="true">
                {actif ? "✓" : "+"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="actions">
        {onAnnuler && (
          <button className="btn" onClick={onAnnuler}>
            Annuler
          </button>
        )}
        <button
          className="btn primary big"
          disabled={choix.length === 0}
          onClick={() => {
            if (choix.length === 0) {
              toast.info("Choisis au moins un oral.");
              return;
            }
            onValider(choix);
          }}
        >
          {premiereFois ? "C'est parti" : "Enregistrer"}
        </button>
      </div>
      {premiereFois && sansSessions && (
        <p className="onboarding-alt">
          Tu veux d&apos;abord voir à quoi ça ressemble ? <a href="/demo-capture.html?vers=/app">Ouvrir avec un exemple</a>
        </p>
      )}
    </div>
  );
}
