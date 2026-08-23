import Link from "next/link";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { estBilan, type Bilan } from "@/lib/bilan";
import BilanVue from "@/app/components/BilanVue";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bilan partagé", robots: { index: false } };

/** Un bilan partagé en lecture seule : tout le monde peut le voir avec le lien, personne ne peut le modifier. */
export default async function PartagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partage = baseConfiguree() && /^[a-z0-9]{12}$/.test(id) ? await prisma.partage.findUnique({ where: { id } }) : null;
  const bilan: Bilan | null = partage && partage.expire > new Date() && estBilan(partage.contenu) ? partage.contenu : null;

  return (
    <div className="legal">
      <header className="legal-head">
        <Link href="/" className="brand">
          <span>
            Soutenance<b>Coach</b>
          </span>
        </Link>
        <nav className="legal-nav">
          <Link href="/app" className="btn small primary">
            Préparer mon oral
          </Link>
        </nav>
      </header>
      <div className="legal-corps">
        {bilan ? (
          <div className="card bilan-carte-papier">
            <BilanVue bilan={bilan} />
          </div>
        ) : (
          <div className="card teaser">Ce lien a expiré ou n&apos;existe pas. Demande un nouveau lien à la personne qui l&apos;a partagé.</div>
        )}
      </div>
    </div>
  );
}
