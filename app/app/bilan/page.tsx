"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { listSessions } from "@/lib/storage";
import { construireBilan, type Bilan } from "@/lib/bilan";
import BilanVue from "@/app/components/BilanVue";
import AntisecheVue from "@/app/components/AntisecheVue";
import { construireAntiseche, type Antiseche } from "@/lib/antiseche";
import { useToast } from "@/app/components/Toast";
import { Icone } from "@/app/components/Icone";

/** Le bilan : à imprimer en PDF, ou à partager par un lien en lecture seule. */
export default function BilanPage() {
  const { data } = useSession();
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [antiseche, setAntiseche] = useState<Antiseche | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const prenom = data?.user?.name?.split(" ")[0];
    setBilan(construireBilan(window.localStorage, listSessions(window.localStorage), prenom));
    setAntiseche(construireAntiseche(window.localStorage));
  }, [data]);

  async function partager() {
    if (!bilan) return;
    setCreation(true);
    try {
      const res = await fetch("/api/partage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bilan }) });
      const j = (await res.json()) as { id?: string; erreur?: string };
      if (res.ok && j.id) {
        const url = `${window.location.origin}/p/${j.id}`;
        setLien(url);
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Lien créé et copié. Valable 30 jours.");
        } catch {
          toast.success("Lien créé. Valable 30 jours.");
        }
      } else toast.error(j.erreur ?? "Le lien n'a pas pu être créé.");
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setCreation(false);
    }
  }

  if (!bilan) return null;

  return (
    <>
      <div className="toolbar bilan-actions">
        <p className="session-meta">Un document propre, sans transcription : pour toi, ou pour ton encadrant.</p>
        <div className="list-actions">
          <button className="btn small" onClick={() => void partager()} disabled={creation}>
            {creation ? "Création…" : <><Icone nom="lien" /> Lien de partage (30 jours)</>}
          </button>
          <button className="btn small primary" onClick={() => window.print()}>
            <Icone nom="imprimer" /> Imprimer / enregistrer en PDF
          </button>
        </div>
      </div>
      {lien && (
        <div className="card notice-lien">
          Lien en lecture seule : <a href={lien}>{lien}</a>
          <p className="session-meta">Quiconque a ce lien voit ce bilan (et rien d&apos;autre) pendant 30 jours. Aucune transcription n&apos;y figure.</p>
        </div>
      )}
      <div className="card bilan-carte-papier">
        <BilanVue bilan={bilan} />
        {antiseche && <AntisecheVue antiseche={antiseche} />}
      </div>
    </>
  );
}
