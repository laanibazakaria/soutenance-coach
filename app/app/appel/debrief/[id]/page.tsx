"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { lireCache } from "@/lib/ia-cache";
import { PERSONAS, type Debrief, type Message, type ModeAppel } from "@/lib/appel";
import type { BilanCamera } from "@/lib/camera";
import type { Evaluation } from "@/lib/grille";
import DebriefAppel from "../../DebriefAppel";

interface AppelSauve {
  mode: ModeAppel;
  dureeMin: number;
  dialogue: Message[];
  debrief: Debrief | null;
  camera?: BilanCamera | null;
  grille?: Evaluation | null;
  date: string;
}

/** Relire le débrief d'un appel passé, depuis l'historique. */
export default function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [appel, setAppel] = useState<AppelSauve | null | undefined>(undefined);
  useEffect(() => {
    setAppel(lireCache<AppelSauve>(window.localStorage, `appel:${id}`));
  }, [id]);
  if (appel === undefined) return null;
  if (!appel || !(appel.mode in PERSONAS)) {
    return (
      <div className="card teaser">
        Cet appel n&apos;est pas sur cet appareil. <Link href="/app/sessions">Retour aux sessions →</Link>
      </div>
    );
  }
  return <DebriefAppel phase="fini" debrief={appel.debrief} erreur={appel.debrief ? null : "Le débrief n'avait pas pu être produit."} historique={appel.dialogue} persona={PERSONAS[appel.mode]} dureeS={appel.dureeMin * 60} sessionId={id} camera={appel.camera ?? null} grille={appel.grille ?? null} onRecommencer={() => window.location.assign(`/app/appel?mode=${appel.mode}`)} />;
}
