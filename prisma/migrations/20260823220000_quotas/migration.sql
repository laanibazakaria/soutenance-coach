-- CreateTable
CREATE TABLE "Usage" (
    "cle" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "appels" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("cle","mois")
);

-- CreateTable
CREATE TABLE "Interet" (
    "email" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interet_pkey" PRIMARY KEY ("email")
);
