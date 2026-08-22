import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Les secrets locaux vivent dans .env.local (ignoré par git) ; .env reste
// disponible pour d'éventuelles valeurs non sensibles.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
