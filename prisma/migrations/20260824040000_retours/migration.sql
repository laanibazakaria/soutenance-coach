-- CreateTable
CREATE TABLE "RetourOral" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ecole" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "ressenti" TEXT,
    "conseil" TEXT,
    "approuve" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetourOral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetourOral_approuve_type_idx" ON "RetourOral"("approuve", "type");
