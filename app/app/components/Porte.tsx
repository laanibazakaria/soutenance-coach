"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import EcranConnexion from "./EcranConnexion";
import { estDemo } from "./SyncCompte";

/**
 * Le mur d'entrée : l'application se visite connecté, comme Propulsez.
 * Passent sans compte : la page de connexion elle-même (et la confirmation
 * du lien magique), et le mode démonstration (captures, « voir un exemple »).
 * Si les comptes ne sont pas configurés (déploiement local sans base), la
 * porte reste ouverte plutôt que d'enfermer dehors.
 */
export default function Porte({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const chemin = usePathname();
  const [pret, setPret] = useState(false);
  const [demo, setDemo] = useState(false);
  const [comptes, setComptes] = useState<{ google: boolean; resend: boolean; mdp: boolean } | null>(null);

  useEffect(() => {
    setDemo(estDemo());
    setPret(true);
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, unknown>) => setComptes({ google: Boolean(p?.google), resend: Boolean(p?.resend), mdp: Boolean(p?.credentials) }))
      .catch(() => setComptes({ google: false, resend: false, mdp: false }));
  }, []);

  if (chemin.startsWith("/app/connexion")) return <>{children}</>;
  if (!pret || status === "loading") return null;
  if (status === "authenticated" || demo) return <>{children}</>;
  if (comptes === null) return null;
  // Déploiement sans base ni Google : rien pour se connecter — on n'enferme pas dehors.
  if (!comptes.google && !comptes.resend && !comptes.mdp) return <>{children}</>;
  // Portail : un ancêtre animé (transform) capturerait un position:fixed.
  return createPortal(
    <div className="porte-plein">
      <EcranConnexion lienDispo={comptes.resend} />
    </div>,
    document.body,
  );
}
