"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icone, IconeBadge } from "@/app/components/Icone";

/**
 * L'étape entre l'e-mail et la connexion : les messageries pré-ouvrent les
 * liens pour les analyser, ce qui consommait le jeton à usage unique avant
 * le vrai clic. Ici, rien ne se passe tant que la personne n'appuie pas.
 */
export default function ConfirmerPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmerInner />
    </Suspense>
  );
}

function ConfirmerInner() {
  const params = useSearchParams();
  const [cible, setCible] = useState<string | null>(null);
  const [invalide, setInvalide] = useState(false);

  useEffect(() => {
    const u = params.get("u");
    try {
      const url = new URL(u ?? "", window.location.origin);
      if (url.origin === window.location.origin && url.pathname === "/api/auth/callback/resend") setCible(url.toString());
      else setInvalide(true);
    } catch {
      setInvalide(true);
    }
  }, [params]);

  if (invalide) {
    return (
      <div className="card etat-vide">
        <IconeBadge nom="alerte" teinte="or" taille={56} rond />
        <h2>Ce lien n&apos;est pas valable</h2>
        <p>Demande un nouveau lien de connexion depuis la page du compte.</p>
        <Link href="/app/connexion" className="btn primary">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="card etat-vide">
      <IconeBadge nom="valide" teinte="vert" taille={56} rond />
      <h2>Un clic, et tu es connecté</h2>
      <p>Ce lien ne sert qu&apos;une fois et reste valable 24 heures. Si tu ne l&apos;as pas demandé, ferme simplement cette page.</p>
      <button className="btn primary big" disabled={!cible} onClick={() => cible && window.location.assign(cible)}>
        <Icone nom="sortie" /> Me connecter
      </button>
    </div>
  );
}
