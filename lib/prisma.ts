import "server-only";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Client Prisma partagé. En développement, Next recharge les modules à chaud :
 * sans ce cache global, chaque rechargement ouvrirait un nouveau pool de
 * connexions jusqu'à épuiser la base.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function creer(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? creer();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Vrai si la base est configurée — sinon l'app reste en mode local pur. */
export function baseConfiguree(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
