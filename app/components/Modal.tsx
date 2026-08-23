"use client";

import { useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  titre?: string;
  largeurMax?: number;
  children: React.ReactNode;
}

/**
 * Modale accessible — une seule implémentation pour toute l'app :
 * role="dialog" + aria-modal + aria-labelledby ; piège à focus (Tab ne sort
 * jamais) ; Échap ferme ; focus initial sur le premier élément focusable —
 * donc sur l'action sûre quand l'appelant la place en premier ; focus
 * restauré à la fermeture sur l'élément qui a ouvert.
 */
export default function Modal({ ouverte, onFermer, titre, largeurMax = 480, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const precedent = useRef<Element | null>(null);
  const titreId = useId();

  useEffect(() => {
    if (!ouverte) return;
    precedent.current = document.activeElement;
    const noeud = ref.current;
    const focusables = noeud ? Array.from(noeud.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    (focusables[0] ?? noeud)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFermer();
        return;
      }
      if (e.key !== "Tab" || !noeud) return;
      const courants = Array.from(noeud.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (courants.length === 0) return;
      const premier = courants[0];
      const dernier = courants[courants.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      (precedent.current as HTMLElement | null)?.focus?.();
    };
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  return (
    <div className="modal-overlay" onClick={onFermer}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titre ? titreId : undefined}
        tabIndex={-1}
        style={{ maxWidth: largeurMax }}
        onClick={(e) => e.stopPropagation()}
      >
        {titre && <h2 id={titreId}>{titre}</h2>}
        {children}
      </div>
    </div>
  );
}
