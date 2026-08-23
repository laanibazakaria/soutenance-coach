"use client";

import { countWords } from "@/lib/storage";
import { SEUILS } from "@/lib/scoring";

const DELAI_MS = 15_000;

/** La jauge de débit en direct : un coach qui lève la main quand ça va trop vite. */
export default function JaugeDebit({ texte, elapsedMs }: { texte: string; elapsedMs: number }) {
  if (elapsedMs < DELAI_MS) return <p className="jauge-debit-attente">Débit mesuré dans {Math.ceil((DELAI_MS - elapsedMs) / 1000)} s…</p>;
  const mots = countWords(texte);
  const wpm = Math.round(mots / (elapsedMs / 60000));
  const { bonMin, bonMax, attentionMin, attentionMax } = SEUILS.debit;
  const etat = wpm >= bonMin && wpm <= bonMax ? "bon" : wpm >= attentionMin && wpm <= attentionMax ? "attention" : "alerte";
  const libelle = wpm > bonMax ? (wpm > attentionMax ? "Trop vite — respire" : "Un peu vite") : wpm < bonMin ? (wpm < attentionMin ? "Trop lent — ou mal entendu" : "Un peu lent") : "Bon rythme";
  const pos = Math.max(0, Math.min(100, ((wpm - 60) / (220 - 60)) * 100));
  return (
    <div className={`jauge-debit jauge-debit-${etat}`} aria-live="off">
      <div className="jauge-debit-piste">
        <span className="jauge-debit-zone" style={{ left: `${((bonMin - 60) / 160) * 100}%`, width: `${((bonMax - bonMin) / 160) * 100}%` }} />
        <span className="jauge-debit-curseur" style={{ left: `${pos}%` }} />
      </div>
      <span className="jauge-debit-texte">
        <b>{wpm} mots/min</b> · {libelle}
      </span>
    </div>
  );
}
