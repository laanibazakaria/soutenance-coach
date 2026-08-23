-- CreateTable
CREATE TABLE "Parcours" (
    "userId" TEXT NOT NULL,
    "dateSoutenance" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dureeMin" INTEGER NOT NULL,
    "creeLe" TEXT NOT NULL,
    "etapesFaites" JSONB NOT NULL,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcours_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Parcours" ADD CONSTRAINT "Parcours_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
