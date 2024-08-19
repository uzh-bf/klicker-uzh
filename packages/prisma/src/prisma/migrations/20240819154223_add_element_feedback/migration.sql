-- CreateTable
CREATE TABLE "ElementFeedback" (
    "id" SERIAL NOT NULL,
    "upvote" BOOLEAN NOT NULL DEFAULT false,
    "downvote" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "participantId" UUID NOT NULL,
    "elementInstanceId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElementFeedback_participantId_elementInstanceId_key" ON "ElementFeedback"("participantId", "elementInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementFeedback_participantId_elementId_key" ON "ElementFeedback"("participantId", "elementId");

-- AddForeignKey
ALTER TABLE "ElementFeedback" ADD CONSTRAINT "ElementFeedback_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementFeedback" ADD CONSTRAINT "ElementFeedback_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementFeedback" ADD CONSTRAINT "ElementFeedback_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
