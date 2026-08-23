"use client";

import React from "react";

interface State {
  erreur: Error | null;
}

/**
 * Filet de sécurité : une erreur de rendu dans une page ne doit jamais
 * laisser un écran blanc. On propose de recharger, et de signaler.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: React.ErrorInfo) {
    console.error("Erreur de rendu interceptée :", erreur, info.componentStack?.slice(0, 500));
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="erreur-page">
        <div className="card erreur-carte">
          <div className="erreur-icone" aria-hidden="true">
            ⚠️
          </div>
          <h2>Oups, quelque chose s&apos;est mal passé</h2>
          <p>Tes données sont intactes — elles sont dans ton navigateur et sur ton compte. Recharge la page pour reprendre.</p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              Recharger la page
            </button>
          </div>
          <a
            className="erreur-signaler"
            href="https://github.com/laanibazakaria/soutenance-coach/issues/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Signaler un problème
          </a>
        </div>
      </div>
    );
  }
}
