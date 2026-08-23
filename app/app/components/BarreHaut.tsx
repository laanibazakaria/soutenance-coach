"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icone } from "@/app/components/Icone";
import { rechercher } from "@/lib/recherche";
import { construireNotifications, lireVues, marquerVues, nonVues } from "@/lib/notifications";
import { useUsage } from "@/lib/usage-client";
import { useEtatApp } from "../hooks/useEtatApp";
import { Marque } from "./Sidebar";

/** Les initiales d'un nom (« Zakaria Laaniba » → « ZL »). */
export function initiales(nom?: string | null): string {
  const parties = (nom ?? "").trim().split(/\s+/).filter(Boolean);
  if (parties.length === 0) return "?";
  return parties
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ nom, image, taille = 34 }: { nom?: string | null; image?: string | null; taille?: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="avatar" width={taille} height={taille} style={{ width: taille, height: taille }} />;
  }
  return (
    <span className="avatar avatar-initiales" style={{ width: taille, height: taille, fontSize: Math.round(taille * 0.36) }} aria-hidden="true">
      {initiales(nom)}
    </span>
  );
}

/** Le libellé du forfait : ce que la barre du haut et le pied de la barre latérale affichent. */
export function libelleForfait(type: "anonyme" | "compte" | undefined): string {
  return type === "compte" ? "Gratuit" : "Sans compte";
}

function Recherche() {
  const router = useRouter();
  const chemin = usePathname();
  const etat = useEtatApp();
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const resultats = useMemo(() => rechercher(q, etat?.sessions ?? []), [q, etat]);
  const vide = resultats.pages.length === 0 && resultats.sessions.length === 0;

  useEffect(() => {
    setOuvert(false);
    setQ("");
  }, [chemin]);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [ouvert]);

  return (
    <div className="barre-recherche" ref={boite}>
      <Icone nom="recherche" taille={15} className="barre-recherche-loupe" />
      <input
        type="search"
        value={q}
        placeholder="Rechercher une page, un guide, une session…"
        aria-label="Rechercher"
        onChange={(e) => {
          setQ(e.target.value);
          setOuvert(e.target.value.trim().length >= 2);
        }}
        onFocus={() => q.trim().length >= 2 && setOuvert(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOuvert(false);
          if (e.key === "Enter" && q.trim().length >= 2) {
            router.push(resultats.pages[0] && resultats.sessions.length === 0 ? resultats.pages[0].lien : `/app/sessions?q=${encodeURIComponent(q.trim())}`);
            setOuvert(false);
          }
        }}
      />
      {ouvert && (
        <div className="barre-resultats" role="listbox">
          {vide ? (
            <div className="barre-resultats-vide">Rien pour « {q} ».</div>
          ) : (
            <>
              {resultats.pages.length > 0 && <div className="barre-resultats-titre">Pages</div>}
              {resultats.pages.map((p) => (
                <Link key={p.lien} href={p.lien} className="barre-resultat" onClick={() => setOuvert(false)}>
                  <span className="barre-resultat-icone">
                    <Icone nom="fleche" taille={13} />
                  </span>
                  <span>
                    <b>{p.titre}</b>
                    <small>{p.detail}</small>
                  </span>
                </Link>
              ))}
              {resultats.sessions.length > 0 && <div className="barre-resultats-titre">Sessions</div>}
              {resultats.sessions.map((s) => (
                <Link key={s.id} href={s.lien} className="barre-resultat" onClick={() => setOuvert(false)}>
                  <span className="barre-resultat-icone">
                    <Icone nom="micro" taille={13} />
                  </span>
                  <span>
                    <b>{s.titre}</b>
                    <small>{s.extrait}</small>
                  </span>
                </Link>
              ))}
              {resultats.sessions.length > 0 && (
                <Link href={`/app/sessions?q=${encodeURIComponent(q.trim())}`} className="barre-resultats-tout" onClick={() => setOuvert(false)}>
                  Voir toutes les sessions →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Cloche() {
  const etat = useEtatApp();
  const usage = useUsage();
  const [ouvert, setOuvert] = useState(false);
  const [vues, setVues] = useState<Set<string>>(new Set());
  const boite = useRef<HTMLDivElement>(null);
  const chemin = usePathname();
  const notifications = useMemo(
    () => (etat ? construireNotifications({ resumes: etat.resumes, quota: usage, qdjFaite: etat.qdjFaite, aujourdhui: etat.aujourdhui }) : []),
    [etat, usage],
  );
  const nouvelles = nonVues(notifications, vues);

  useEffect(() => setVues(lireVues(window.localStorage)), []);
  useEffect(() => setOuvert(false), [chemin]);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [ouvert]);

  function basculer() {
    const prochain = !ouvert;
    setOuvert(prochain);
    if (prochain && nouvelles > 0) setVues(marquerVues(window.localStorage, notifications.map((n) => n.id)));
  }

  return (
    <div className="cloche" ref={boite}>
      <button type="button" className="cloche-bouton" onClick={basculer} aria-label={nouvelles > 0 ? `${nouvelles} notifications` : "Notifications"} aria-expanded={ouvert}>
        <Icone nom="cloche" taille={18} />
        {nouvelles > 0 && <span className="cloche-point" aria-hidden="true" />}
      </button>
      {ouvert && (
        <div className="cloche-panneau">
          <div className="cloche-tete">
            <b>Notifications</b>
            <span className="session-meta">{notifications.length === 0 ? "rien à signaler" : `${notifications.length} à voir`}</span>
          </div>
          {notifications.length === 0 ? (
            <div className="cloche-vide">Tout est calme. Reviens demain pour la question du jour.</div>
          ) : (
            notifications.map((n) => (
              <Link key={n.id} href={n.lien} className={`cloche-item cloche-${n.niveau}`} onClick={() => setOuvert(false)}>
                <span className="cloche-item-icone">
                  <Icone nom={n.niveau === "attention" ? "alerte" : n.niveau === "succes" ? "valide" : "info"} taille={15} />
                </span>
                <span>
                  <b>{n.titre}</b>
                  <small>{n.detail}</small>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** La barre du haut : recherche, forfait, cloche, avatar — logo et cloche sur mobile. */
export default function BarreHaut() {
  const { data: session, status } = useSession();
  const usage = useUsage();
  const connecte = status === "authenticated" && !!session?.user;

  return (
    <header className="barre-haut">
      <div className="barre-haut-mobile">
        <Marque taille={22} />
      </div>
      <Recherche />
      <span className="barre-haut-espace" aria-hidden="true" />
      {usage && (
        <Link href="/app/forfaits" className="barre-forfait" title="Ton forfait et ton quota IA du mois">
          {libelleForfait(usage.type)}
        </Link>
      )}
      <Cloche />
      {connecte ? (
        <Link href="/app/connexion" className="barre-avatar" aria-label="Mon compte">
          <Avatar nom={session?.user?.name} image={session?.user?.image} />
        </Link>
      ) : (
        status !== "loading" && (
          <Link href="/app/connexion" className="btn small primary barre-connexion">
            Se connecter
          </Link>
        )
      )}
    </header>
  );
}
