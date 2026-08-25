import Link from "next/link";

/**
 * La page qui n'existe pas. Sans ce fichier, Next affichait son « 404 This
 * page could not be found » — en anglais, sans un lien de retour, au milieu
 * d'un produit entièrement rédigé en français.
 */
export default function PageIntrouvable() {
  return (
    <main className="page-hors-piste">
      <p className="page-hors-piste-code" aria-hidden="true">404</p>
      <h1>Cette page n&apos;existe pas</h1>
      <p>
        L&apos;adresse est peut-être mal recopiée, ou la page a été déplacée — la plateforme a
        beaucoup bougé ces derniers temps.
      </p>
      <div className="page-hors-piste-actions">
        <Link href="/app" className="btn primary">Retour à l&apos;application</Link>
        <Link href="/" className="btn">La page d&apos;accueil</Link>
      </div>
    </main>
  );
}
