import { NextResponse } from "next/server";
import webpush from "web-push";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { joursEntre, dateDuJour } from "@/lib/parcours";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Rappel {
  titre: string;
  corps: string;
  url: string;
  tag: string;
}

/** Le rappel d'un compte : l'échéance la plus proche, sinon la question du jour. */
function rappelPour(echeances: { nom: string; date: string | null; url: string }[], aujourdhui: string): Rappel {
  const proches = echeances
    .filter((e): e is { nom: string; date: string; url: string } => Boolean(e.date))
    .map((e) => ({ ...e, jours: joursEntre(aujourdhui, e.date) }))
    .filter((e) => e.jours >= 0 && e.jours <= 7)
    .sort((a, b) => a.jours - b.jours);
  const p = proches[0];
  if (p) {
    if (p.jours === 0) return { titre: `C'est aujourd'hui — ${p.nom}`, corps: "Arrive en avance, respire, commence par ton accroche. Tu as préparé.", url: p.url, tag: "jour-j" };
    if (p.jours === 1) return { titre: `Demain : ${p.nom}`, corps: "Ce soir : relis, ne répète plus. Pitch, fiches, trois questions difficiles — puis dors.", url: p.url, tag: "veille" };
    return { titre: `J-${p.jours} — ${p.nom}`, corps: "Ta question du jour t'attend : une minute au micro, et le parcours te dit ce qui reste.", url: "/app/question-du-jour", tag: "echeance" };
  }
  return { titre: "Ta question du jour", corps: "Une question de ton jury, une minute au micro, un retour. Cinq minutes bien placées.", url: "/app/question-du-jour", tag: "question-du-jour" };
}

/**
 * Tâche planifiée (Vercel Cron, une fois par jour) : un rappel par abonné.
 * Protégée par CRON_SECRET. Les abonnements morts sont supprimés.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }
  if (!baseConfiguree() || !process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ erreur: "Push non configuré." }, { status: 503 });
  }
  webpush.setVapidDetails("mailto:zakaria.laaniba@gmail.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const aujourdhui = dateDuJour();
  const abonnes = await prisma.pushAbonnement.findMany({ take: 500 });
  let envoyes = 0;
  let supprimes = 0;
  for (const a of abonnes) {
    const echeances: { nom: string; date: string | null; url: string }[] = [];
    if (a.userId) {
      const [parcours, candidature, profils] = await Promise.all([
        prisma.parcours.findUnique({ where: { userId: a.userId } }),
        prisma.candidature.findUnique({ where: { userId: a.userId } }),
        prisma.profilModule.findMany({ where: { userId: a.userId } }),
      ]);
      if (parcours) echeances.push({ nom: "ta soutenance", date: parcours.dateSoutenance, url: "/app/soutenance" });
      if (candidature) echeances.push({ nom: `ton entretien${candidature.entreprise ? ` chez ${candidature.entreprise}` : ""}`, date: candidature.dateEntretien, url: "/app/entretien" });
      for (const p of profils) echeances.push({ nom: p.module === "pitch" ? "ton pitch" : "ton oral de concours", date: p.date, url: `/app/m/${p.module}` });
    }
    const r = rappelPour(echeances, aujourdhui);
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(r), { TTL: 6 * 3600 });
      envoyes++;
    } catch (e) {
      const statut = (e as { statusCode?: number }).statusCode;
      if (statut === 404 || statut === 410) {
        await prisma.pushAbonnement.delete({ where: { endpoint: a.endpoint } }).catch(() => {});
        supprimes++;
      }
    }
  }
  return NextResponse.json({ ok: true, abonnes: abonnes.length, envoyes, supprimes, date: aujourdhui });
}
