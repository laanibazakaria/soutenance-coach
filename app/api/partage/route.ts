import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { estBilan } from "@/lib/bilan";

const DUREE_JOURS = 30;
const TAILLE_MAX = 60_000;

/** Crée un lien de partage en lecture seule d'un bilan — sans transcription, 30 jours. */
export async function POST(request: Request) {
  if (!baseConfiguree()) return NextResponse.json({ erreur: "Indisponible sur ce déploiement." }, { status: 503 });
  let corps: { bilan?: unknown };
  try {
    corps = (await request.json()) as { bilan?: unknown };
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (!estBilan(corps.bilan)) return NextResponse.json({ erreur: "Bilan invalide." }, { status: 400 });
  const contenu = JSON.stringify(corps.bilan);
  if (contenu.length > TAILLE_MAX) return NextResponse.json({ erreur: "Bilan trop volumineux." }, { status: 413 });

  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  await prisma.partage.create({ data: { id, contenu: corps.bilan as object, expire: new Date(Date.now() + DUREE_JOURS * 86_400_000) } });
  return NextResponse.json({ id });
}
