-- CreateTable
CREATE TABLE "Migration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Migration_pkey" PRIMARY KEY ("id")
);
