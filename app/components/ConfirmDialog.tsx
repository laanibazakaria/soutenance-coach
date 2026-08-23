"use client";

import Modal from "./Modal";

interface Props {
  ouverte: boolean;
  onFermer: () => void;
  onConfirmer: () => void;
  titre: string;
  message?: string;
  libelleConfirmer?: string;
  libelleAnnuler?: string;
  danger?: boolean;
}

/**
 * Dialogue de confirmation. « Annuler » est le premier élément focusable du
 * DOM — c'est lui qui reçoit le focus à l'ouverture — jamais « Confirmer » :
 * sur une action destructive, un appui accidentel sur Entrée ne doit jamais
 * déclencher l'irréversible.
 */
export default function ConfirmDialog({
  ouverte,
  onFermer,
  onConfirmer,
  titre,
  message,
  libelleConfirmer = "Confirmer",
  libelleAnnuler = "Annuler",
  danger = false,
}: Props) {
  return (
    <Modal ouverte={ouverte} onFermer={onFermer} titre={titre} largeurMax={420}>
      {message && <p className="modal-message">{message}</p>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onFermer}>
          {libelleAnnuler}
        </button>
        <button
          type="button"
          className={`btn ${danger ? "danger plein" : "primary"}`}
          onClick={() => {
            onConfirmer();
            onFermer();
          }}
        >
          {libelleConfirmer}
        </button>
      </div>
    </Modal>
  );
}
