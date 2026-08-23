import { NextResponse } from "next/server";
import { prisma, baseConfiguree } from "@/lib/prisma";
import { iaConfiguree, fournisseursDisponibles } from "@/lib/llm";
import { authConfiguree } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * État de santé, lisible par un humain ou une sonde : la base répond-elle,
 * l'IA et les comptes sont-ils configurés. Aucune donnée utilisateur.
 */
export async function GET() {
  let base: "ok" | "absente" | "injoignable" = "absente";
  if (baseConfiguree()) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      base = "ok";
    } catch {
      base = "injoignable";
    }
  }
  const ok = base !== "injoignable";
  return NextResponse.json(
    {
      ok,
      base,
      ia: iaConfiguree() ? "ok" : "absente",
      fournisseurs: fournisseursDisponibles(),
      comptes: authConfiguree() ? "ok" : "absents",
      horodatage: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
