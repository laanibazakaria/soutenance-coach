"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUsage } from "@/lib/usage-client";

/** L'événement d'installation PWA, absent des types du DOM. */
interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
}

/**
 * « Installer l'app » : visible seulement quand le navigateur propose
 * vraiment l'installation (Chrome Android, Edge, desktop). Une fois
 * installée, l'événement ne revient plus — le bouton disparaît seul.
 */
function InstallerApp() {
  const [invite, setInvite] = useState<EvenementInstallation | null>(null);
  useEffect(() => {
    const capter = (e: Event) => {
      e.preventDefault();
      setInvite(e as EvenementInstallation);
    };
    window.addEventListener("beforeinstallprompt", capter);
    return () => window.removeEventListener("beforeinstallprompt", capter);
  }, []);
  if (!invite) return null;
  return (
    <button
      className="installer-app"
      onClick={() => {
        void invite.prompt();
        setInvite(null);
      }}
    >
      📲 Installer l&apos;app sur cet appareil
    </button>
  );
}
import { useEtatApp, oralPrioritaire } from "../hooks/useEtatApp";
import { useEtatSync, libelleSync } from "./SyncCompte";
import { Avatar, libelleForfait } from "./BarreHaut";
import { moduleDuChemin } from "./ModuleTabs";
import { lireModulesActifs, TOUS_LES_MODULES, type ModuleActif } from "@/lib/preferences";
import { surSynchronisation } from "@/lib/sync/client";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCandidature } from "@/lib/entretien/persistance";
import { lireCache } from "@/lib/ia-cache";
import { estRapport } from "@/lib/rapport";

/* Icônes en traits fins (24×24, stroke 1.8). */
const I = {
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  ),
  accueil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z" /><path d="M9 21V14h6v7" /></svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  guides: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  ),
  soutenance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
  ),
  entretien: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
  ),
  pitch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>
  ),
  concours: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
  ),
  compte: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M20 21c0-3.87-3.58-7-8-7s-8 3.13-8 7" /></svg>
  ),
  forfaits: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  jour: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
  ),
  appel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
  ),
  micro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
  ),
};

const ICONES_MODULES: Record<ModuleActif, React.ReactNode> = { soutenance: I.soutenance, entretien: I.entretien };

export function Marque({ taille = 24 }: { taille?: number }) {
  return (
    <Link href="/" className="brand">
      <svg width={taille} height={taille} viewBox="0 0 150 150" aria-hidden="true">
        <g transform="translate(75,75)">
          <path
            d="M0,-62 L11,-15 L44,-44 L15,-11 L62,0 L15,11 L44,44 L11,15 L0,62 L-11,15 L-44,44 L-15,11 L-62,0 L-15,-11 L-44,-44 L-11,-15 Z"
            fill="none"
            stroke="#0f766e"
            strokeWidth="7"
          />
          <circle r="8" fill="#f59e0b" />
        </g>
      </svg>
      <span>
        Soutenance<b>Coach</b>
      </span>
    </Link>
  );
}

/** Les modules actifs, relus après chaque synchronisation ou changement de préférences. */
function useModulesActifs(): ModuleActif[] {
  const [actifs, setActifs] = useState<ModuleActif[]>([]);
  useEffect(() => {
    const lire = () => setActifs(lireModulesActifs(window.localStorage) ?? []);
    lire();
    return surSynchronisation(lire);
  }, []);
  return actifs;
}

function LienNav({ href, label, icone, actif, etape, faite }: { href: string; label: string; icone: React.ReactNode; actif: boolean; etape?: number; faite?: boolean }) {
  return (
    <Link href={href} className={`sidebar-link${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
      {etape ? <span className={`sidebar-etape${faite ? " faite" : ""}`} aria-hidden="true">{faite ? "✓" : etape}</span> : <span className="sidebar-icone">{icone}</span>}
      {label}
    </Link>
  );
}

/** Barre latérale (bureau) : navigation, les oraux choisis, l'action principale, le compte. */
export default function Sidebar() {
  const chemin = usePathname();
  // Le tiroir mobile : ouvert par le bouton de la barre du haut, refermé par
  // le voile, la croix, ou n'importe quelle navigation. Sur bureau, cet état
  // est sans effet — la barre est toujours visible.
  const [ouverte, setOuverte] = useState(false);
  useEffect(() => {
    const ouvrir = () => setOuverte(true);
    window.addEventListener("menu-mobile", ouvrir);
    return () => window.removeEventListener("menu-mobile", ouvrir);
  }, []);
  useEffect(() => setOuverte(false), [chemin]);
  const actifs = useModulesActifs();
  const usage = useUsage();
  const admin = usage?.admin ?? false;
  const moduleCourant = moduleDuChemin(chemin)?.id;
  const modules = TOUS_LES_MODULES.filter((m) => actifs.includes(m.id));
  const soutenanceActive = actifs.includes("soutenance") || actifs.length === 0;
  const [etat, setEtat] = useState({ e1: false, e2: false });
  useEffect(() => {
    const lire = () => {
      const st = window.localStorage;
      const e1 = soutenanceActive
        ? listeDeckSauvegarde(st) !== null && estRapport(lireCache<unknown>(st, "rapport:texte"))
        : lireCandidature(st) !== null;
      // Un appel déjà passé pour ce mode : la clé du cache suffit.
      let e2 = false;
      for (let i = 0; i < st.length; i++) {
        const k = st.key(i);
        if (k && k.startsWith("sc.ia.v1:appel:")) { e2 = true; break; }
      }
      setEtat({ e1, e2 });
    };
    lire();
    return surSynchronisation(lire);
  }, [soutenanceActive]);
  const etape1Faite = etat.e1;
  const etape2Faite = etat.e2;

  return (
    <>
    {ouverte && <button type="button" className="sidebar-voile" aria-label="Fermer le menu" onClick={() => setOuverte(false)} />}
    <nav className={`sidebar${ouverte ? " ouverte" : ""}`} aria-label="Navigation principale">
      <div className="sidebar-brand">
        <Marque taille={26} />
      </div>

      <LienNav href="/app" label="Accueil" icone={I.accueil} actif={chemin === "/app"} />

      <div className="sidebar-section">Le chemin</div>
      {soutenanceActive ? (
        <LienNav href="/app/documents" etape={1} label="Dépose tes documents" icone={I.documents} actif={chemin.startsWith("/app/documents")} faite={etape1Faite} />
      ) : (
        <LienNav href="/app/entretien" etape={1} label="Renseigne CV et offre" icone={I.documents} actif={false} faite={etape1Faite} />
      )}
      <LienNav href="/app/appel" etape={2} label={soutenanceActive ? "Appelle ton jury" : "Appelle le recruteur"} icone={I.appel} actif={chemin.startsWith("/app/appel")} faite={etape2Faite} />
      <LienNav href="/app/bilan" etape={3} label="Suis ta progression" icone={I.sessions} actif={chemin.startsWith("/app/bilan")} />

      <div className="sidebar-section">Chaque jour</div>
      <LienNav href="/app/question-du-jour" label="La question du jour" icone={I.jour} actif={chemin.startsWith("/app/question-du-jour")} />
      <LienNav href="/app/sessions" label="Mes sessions passées" icone={I.sessions} actif={chemin.startsWith("/app/sessions")} />
      <LienNav href="/app/revision" label="Tout revoir" icone={I.guides} actif={chemin.startsWith("/app/revision")} />
      <LienNav href="/app/guides" label="Les guides" icone={I.guides} actif={chemin === "/app/guides"} />

      <div className="sidebar-section">Mes oraux</div>
      {modules.map((m) => (
        <LienNav key={m.id} href={m.hub} label={m.nom} icone={ICONES_MODULES[m.id]} actif={moduleCourant === m.id} />
      ))}
      <Link href="/app?choisir=1" className="sidebar-link sidebar-link-ajout">
        <span className="sidebar-icone">{I.plus}</span>
        {modules.length === 0 ? "Choisir mes oraux" : "Ajouter un oral"}
      </Link>

      <div className="sidebar-section">Compte</div>
      <LienNav href="/app/connexion" label="Mon compte" icone={I.compte} actif={chemin.startsWith("/app/connexion")} />
      <LienNav href="/app/forfaits" label="Forfaits" icone={I.forfaits} actif={chemin.startsWith("/app/forfaits")} />
      {admin && <LienNav href="/app/admin" label="Admin" icone={I.admin} actif={chemin.startsWith("/app/admin")} />}

      <div className="sidebar-bas">
        <CartePreparation />
        <Link href="/app/session" className="btn primary sidebar-cta">
          <span className="sidebar-icone">{I.micro}</span>
          S'entraîner au micro
        </Link>
      </div>
      <PiedUtilisateur />
    </nav>
    </>
  );
}

/** La carte « préparation » : l'oral le plus proche, et où on en est. */
function CartePreparation() {
  const etat = useEtatApp();
  const oral = etat ? oralPrioritaire(etat.resumes) : null;
  if (!oral) return null;
  const pct = oral.pourcent ?? 0;
  return (
    <Link href={oral.hub} className="sidebar-prep" title={oral.prochaineAction.titre}>
      <span className="sidebar-prep-ligne">
        <span className="sidebar-prep-nom">
          {oral.nom}
          {oral.jours !== null && oral.jours >= 0 && <span className="sidebar-prep-j">J-{oral.jours}</span>}
        </span>
        <b>{pct}%</b>
      </span>
      <span className="sidebar-prep-barre">
        <span style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

/** Le pied : qui est connecté, le forfait, le quota — ou l'invitation à se connecter. */
function PiedUtilisateur() {
  const { data: session, status } = useSession();
  const usage = useUsage();
  const sync = useEtatSync();
  const connecte = status === "authenticated" && !!session?.user;
  const ratio = usage && usage.limite > 0 ? Math.min(1, usage.appels / usage.limite) : 0;
  return (
    <div className="sidebar-pied">
      <InstallerApp />
      {connecte ? (
        <Link href="/app/connexion" className="sidebar-user">
          <Avatar nom={session?.user?.name} image={session?.user?.image} />
          <span className="sidebar-user-texte">
            <span className="sidebar-user-nom">{session?.user?.name ?? "Connecté"}</span>
            <span className="sidebar-user-ligne">
              <span className="sidebar-plan">{libelleForfait(usage?.type)}</span>
              <span className="sidebar-upgrader">Upgrader</span>
            </span>
          </span>
        </Link>
      ) : (
        <Link href="/app/connexion" className="sidebar-user">
          <Avatar nom={null} />
          <span className="sidebar-user-texte">
            <span className="sidebar-user-nom">Sans compte</span>
            <span className="sidebar-user-ligne">
              <span className="sidebar-upgrader">Se connecter →</span>
            </span>
          </span>
        </Link>
      )}
      {usage && (
        <Link href="/app/forfaits" className={`sidebar-quota${ratio >= 1 ? " plein" : ratio >= 0.75 ? " haut" : ""}`} title="Appels à l'IA ce mois — pitch, questions, fiches, coach, jury">
          <span className="sidebar-quota-ligne">
            <span>IA ce mois</span>
            <b>
              {usage.appels}/{usage.limite}
            </b>
          </span>
          <span className="sidebar-quota-barre">
            <span style={{ width: `${ratio * 100}%` }} />
          </span>
        </Link>
      )}
      <div className="sidebar-legal">
        <span className="sidebar-sync" title={libelleSync(sync)}>
          <span className={`sidebar-sync-point sidebar-sync-${sync}`} aria-hidden="true" />
          {libelleSync(sync)}
        </span>
        <span>
          <Link href="/confidentialite">Confidentialité</Link> · <Link href="/mentions-legales">Mentions</Link> ·{" "}
          <a href="https://github.com/laanibazakaria/soutenance-coach/issues/new" target="_blank" rel="noopener noreferrer">
            Idée / bug
          </a>
        </span>
      </div>
    </div>
  );
}

/** Onglets du bas (mobile) : l'ordre du parcours — déposer, répéter, revoir.
 *  La barre latérale est masquée sous 900 px : ces cinq onglets sont toute la
 *  navigation, d'où la place donnée aux documents plutôt qu'au premier module,
 *  déjà atteignable depuis l'accueil. */
export function OngletsMobiles() {
  const chemin = usePathname();
  const onglet = (href: string, label: string, icone: React.ReactNode, actif: boolean) => (
    <Link key={href} href={href} className={`mobile-tab${actif ? " active" : ""}`} aria-current={actif ? "page" : undefined}>
      <span className="sidebar-icone">{icone}</span>
      {label}
    </Link>
  );
  return (
    <nav className="mobile-tabs" aria-label="Sections">
      {onglet("/app", "Accueil", I.accueil, chemin === "/app")}
      {onglet("/app/documents", "Documents", I.documents, chemin.startsWith("/app/documents"))}
      <Link href="/app/session" className="mobile-tab mobile-tab-record" aria-label="S'entraîner au micro">
        <span className="mobile-record">{I.micro}</span>
      </Link>
      {onglet("/app/sessions", "Sessions", I.sessions, chemin.startsWith("/app/sessions"))}
      {onglet("/app/appel", "Appel", I.appel, chemin.startsWith("/app/appel"))}
    </nav>
  );
}
