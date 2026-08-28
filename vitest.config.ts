import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * L'alias « @/ » que Next résout depuis tsconfig — vitest ne lit pas les
 * paths de TypeScript. Sans lui, aucun test ne pouvait importer un module
 * qui importe lui-même en « @/ » : c'est pour ça que quota-serveur, le seul
 * garde-fou des quotas, est resté sans test si longtemps.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
