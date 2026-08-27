-- CreateTable
CREATE TABLE "UserProductUpdateState" (
    "id" SERIAL NOT NULL,
    "updateId" TEXT NOT NULL,
    "firstPresentedAt" TIMESTAMP(3) NOT NULL,
    "lastPresentedAt" TIMESTAMP(3) NOT NULL,
    "presentationCount" INTEGER NOT NULL DEFAULT 0,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProductUpdateState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantProductUpdateState" (
    "id" SERIAL NOT NULL,
    "updateId" TEXT NOT NULL,
    "firstPresentedAt" TIMESTAMP(3) NOT NULL,
    "lastPresentedAt" TIMESTAMP(3) NOT NULL,
    "presentationCount" INTEGER NOT NULL DEFAULT 0,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantProductUpdateState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProductUpdateState_userId_updateId_key" ON "UserProductUpdateState"("userId", "updateId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantProductUpdateState_participantId_updateId_key" ON "ParticipantProductUpdateState"("participantId", "updateId");

-- AddForeignKey
ALTER TABLE "UserProductUpdateState" ADD CONSTRAINT "UserProductUpdateState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantProductUpdateState" ADD CONSTRAINT "ParticipantProductUpdateState_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
