-- CreateTable
CREATE TABLE "PushAbonnement" (
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT,
    "fuseau" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushAbonnement_pkey" PRIMARY KEY ("endpoint")
);

-- CreateIndex
CREATE INDEX "PushAbonnement_userId_idx" ON "PushAbonnement"("userId");
