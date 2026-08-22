"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { synchroniser, marquerDeconnecte } from "@/lib/sync/client";

/**
 * Coin compte de la barre supérieure : état de connexion, synchronisation,
 * déconnexion. Sans compte, rappelle que tout reste local.
 */
export default function AccountBar() {
  const { data: session, status } = useSession();
  const [etat, setEtat] = useState<"idle" | "sync" | "ok" | "erreur">("idle");

  useEffect(() => {
    if (status === "authenticated") {
      setEtat("sync");
      void synchroniser().then((r) => setEtat(r.ok ? "ok" : "erreur"));
    } else if (status === "unauthenticated") {
      marquerDeconnecte();
      setEtat("idle");
    }
  }, [status]);

  if (status === "loading") return <span className="privacy-note">…</span>;

  if (!session?.user) {
    return (
      <span className="account">
        <span className="privacy-note">100 % local — rien ne quitte ton navigateur</span>
        <Link href="/app/connexion" className="btn small">
          Se connecter
        </Link>
      </span>
    );
  }

  const prenom = session.user.name?.split(" ")[0] ?? "toi";
  return (
    <span className="account">
      <span className="privacy-note">
        {etat === "sync" && "Synchronisation…"}
        {etat === "ok" && "☁️ Synchronisé sur ton compte"}
        {etat === "erreur" && "Hors ligne — données locales"}
        {etat === "idle" && "Connecté"}
      </span>
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.user.image} alt="" className="avatar" width={28} height={28} />
      ) : null}
      <span className="account-name">{prenom}</span>
      <button className="btn small" onClick={() => void signOut({ callbackUrl: "/app" })}>
        Déconnexion
      </button>
    </span>
  );
}
