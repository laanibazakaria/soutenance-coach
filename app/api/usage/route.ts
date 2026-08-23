import { NextResponse } from "next/server";
import { lireQuota } from "@/lib/quota-serveur";

export const dynamic = "force-dynamic";

/** L'état du quota IA de l'appelant — affiché dans la barre latérale. */
export async function GET(request: Request) {
  const etat = await lireQuota(request);
  return NextResponse.json(etat, { headers: { "cache-control": "no-store" } });
}
