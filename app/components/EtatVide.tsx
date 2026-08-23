import Link from "next/link";
import { IconeBadge, type NomIcone, type Teinte } from "@/app/components/Icone";

/**
 * Un état vide qui guide : une icône, une phrase, une seule action — et, au
 * besoin, une seconde porte discrète (voir un exemple, importer un fichier).
 */
export default function EtatVide({
  icone,
  teinte = "violet",
  titre,
  texte,
  action,
  secondaire,
  niveau = 2,
}: {
  icone: NomIcone;
  teinte?: Teinte;
  titre: string;
  texte: string;
  action?: { libelle: string; href: string };
  secondaire?: React.ReactNode;
  niveau?: 2 | 3;
}) {
  const Titre = niveau === 2 ? "h2" : "h3";
  return (
    <div className="card etat-vide">
      <IconeBadge nom={icone} teinte={teinte} taille={64} rond />
      <Titre>{titre}</Titre>
      <p>{texte}</p>
      {action && (
        <Link href={action.href} className="btn primary">
          {action.libelle}
        </Link>
      )}
      {secondaire && <div className="etat-vide-secondaire">{secondaire}</div>}
    </div>
  );
}
