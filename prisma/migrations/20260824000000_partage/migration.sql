-- CreateTable
CREATE TABLE "Partage" (
    "id" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expire" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partage_pkey" PRIMARY KEY ("id")
);
