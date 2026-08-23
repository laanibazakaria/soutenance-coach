-- CreateTable
CREATE TABLE "ProfilModule" (
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "champs" JSONB NOT NULL,
    "documentTexte" TEXT NOT NULL,
    "documentNom" TEXT,
    "date" TEXT,
    "etapesFaites" JSONB NOT NULL,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilModule_pkey" PRIMARY KEY ("userId","module")
);

-- AddForeignKey
ALTER TABLE "ProfilModule" ADD CONSTRAINT "ProfilModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
