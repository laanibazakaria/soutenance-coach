"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { surSynchronisation } from "@/lib/sync/client";
import type { EtatQuota } from "@/lib/quota";

type Etat = EtatQuota & { admin: boolean };

/** Le compteur d'appels IA du mois, et le lien admin s'il y a lieu. */
export default function UsageBadge({ onAdmin }: { onAdmin?: (admin: boolean) => void }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const { status } = useSession();

  useEffect(() => {
    let annule = false;
    const lire = () =>
      fetch("/api/usage", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((e: Etat | null) => {
          if (!annule && e) {
            setEtat(e);
            onAdmin?.(e.admin);
          }
        })
        .catch(() => {});
    void lire();
    const off = surSynchronisation(lire);
    const t = setInterval(lire, 120_000);
    return () => {
      annule = true;
      off();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!etat) return null;
  const ratio = etat.limite > 0 ? etat.appels / etat.limite : 1;
  const niveau = ratio >= 1 ? "plein" : ratio >= 0.75 ? "haut" : "ok";
  return (
    <Link href="/app/forfaits" className={`usage usage-${niveau}`} title="Appels à l'IA ce mois — pitch, questions, fiches, coach, jury">
      <span className="usage-barre">
        <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </span>
      <span className="usage-texte">
        IA : {etat.appels}/{etat.limite} ce mois{etat.type === "anonyme" && " · sans compte"}
      </span>
    </Link>
  );
}
