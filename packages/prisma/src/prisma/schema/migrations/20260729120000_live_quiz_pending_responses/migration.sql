CREATE TABLE "public"."LiveQuizPendingResponse" (
    "id" UUID NOT NULL,
    "eventPayload" TEXT NOT NULL,
    "nextDeliveryAt" TIMESTAMP(3) NOT NULL,
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liveQuizId" UUID NOT NULL,

    CONSTRAINT "LiveQuizPendingResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveQuizPendingResponse_liveQuizId_idx"
ON "public"."LiveQuizPendingResponse"("liveQuizId");

CREATE INDEX "LiveQuizPendingResponse_nextDeliveryAt_idx"
ON "public"."LiveQuizPendingResponse"("nextDeliveryAt");

ALTER TABLE "public"."LiveQuizPendingResponse"
ADD CONSTRAINT "LiveQuizPendingResponse_liveQuizId_fkey"
FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
