-- CreateTable
CREATE TABLE "UserTourState" (
    "id" SERIAL NOT NULL,
    "tourId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTourState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantTourState" (
    "id" SERIAL NOT NULL,
    "tourId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantTourState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTourState_userId_tourId_key" ON "UserTourState"("userId", "tourId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantTourState_participantId_tourId_key" ON "ParticipantTourState"("participantId", "tourId");

-- AddForeignKey
ALTER TABLE "UserTourState" ADD CONSTRAINT "UserTourState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantTourState" ADD CONSTRAINT "ParticipantTourState_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
