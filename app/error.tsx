"use client";

/**
 * La frontière d'erreur globale. Sans elle, une exception non rattrapée
 * affichait l'écran technique de Next — « Application error », en anglais.
 * Rien n'est perdu côté données : tout vit dans le stockage local du
 * navigateur, un rechargement suffit presque toujours.
 */
export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-hors-piste">
      <p className="page-hors-piste-code" aria-hidden="true">Oups</p>
      <h1>Quelque chose s&apos;est cassé</h1>
      <p>
        Ce n&apos;est pas toi, c&apos;est nous. Tes sessions, tes documents et tes fiches sont sur
        ton appareil : rien n&apos;est perdu. Réessaie — et si ça se reproduit, signale-le depuis le
        pied de page.
      </p>
      {error.digest && <p className="page-hors-piste-ref">Référence : {error.digest}</p>}
      <div className="page-hors-piste-actions">
        <button className="btn primary" onClick={() => reset()}>Réessayer</button>
        <a href="/app" className="btn">Retour à l&apos;application</a>
      </div>
    </main>
  );
}
