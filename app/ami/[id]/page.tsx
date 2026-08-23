import Link from "next/link";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { estSeanceAmi, type SeanceAmi } from "@/lib/ami";
import AmiJury from "@/app/components/AmiJury";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu es le jury", robots: { index: false } };

/** La page de l'ami : il joue le jury, sans compte, avec le lien. */
export default async function AmiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = baseConfiguree() && /^[a-z0-9]{12}$/.test(id) ? await prisma.partage.findUnique({ where: { id } }) : null;
  const seance: SeanceAmi | null = p && p.expire > new Date() && estSeanceAmi(p.contenu) ? p.contenu : null;

  return (
    <div className="legal">
      <header className="legal-head">
        <Link href="/" className="brand">
          <span>
            Soutenance<b>Coach</b>
          </span>
        </Link>
        <nav className="legal-nav">
          <Link href="/app" className="btn small">
            Préparer mon propre oral
          </Link>
        </nav>
      </header>
      <div className="legal-corps">
        {seance ? (
          <AmiJury id={id} seance={{ ...seance, retours: [] }} />
        ) : (
          <div className="card teaser">Ce lien a expiré ou n&apos;existe pas. Demande un nouveau lien à la personne qui t&apos;a invité.</div>
        )}
      </div>
    </div>
  );
}
