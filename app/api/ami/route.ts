import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { construireSeance, type QuestionAmi } from "@/lib/ami";

const DUREE_JOURS = 30;

/** Crée une séance « répéter avec un ami » : un lien valable 30 jours. */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible sur ce déploiement." }, { status: 503 });
  let corps: { titre?: unknown; persona?: unknown; dureeS?: unknown; questions?: unknown };
  try {
    corps = (await request.json()) as typeof corps;
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const questions = Array.isArray(corps.questions) ? (corps.questions as QuestionAmi[]) : [];
  const seance = construireSeance(String(corps.titre ?? ""), String(corps.persona ?? "Jury"), Number(corps.dureeS ?? 60), questions);
  if (seance.questions.length === 0) return NextResponse.json({ erreur: "Il faut au moins une question." }, { status: 400 });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  await prisma.partage.create({ data: { id, contenu: seance as object, expire: new Date(Date.now() + DUREE_JOURS * 86_400_000) } });
  return NextResponse.json({ id });
}
