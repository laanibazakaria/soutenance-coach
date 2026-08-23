-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN "mode" TEXT;

-- CreateTable
CREATE TABLE "Candidature" (
    "userId" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "entreprise" TEXT NOT NULL,
    "typeEntretien" TEXT NOT NULL,
    "dateEntretien" TEXT,
    "offre" TEXT NOT NULL,
    "cvTexte" TEXT NOT NULL,
    "cvNomFichier" TEXT,
    "etapesFaites" JSONB NOT NULL,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidature_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
