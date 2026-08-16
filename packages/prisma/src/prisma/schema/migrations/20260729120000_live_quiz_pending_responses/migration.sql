CREATE TABLE "public"."LiveQuizPendingResponse" (
    "id" UUID NOT NULL,
    "responseKey" TEXT NOT NULL,
    "eventPayload" TEXT,
    "nextDeliveryAt" TIMESTAMP(3),
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "liveQuizId" UUID NOT NULL,

    CONSTRAINT "LiveQuizPendingResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveQuizPendingResponse_liveQuizId_idx"
ON "public"."LiveQuizPendingResponse"("liveQuizId");

CREATE UNIQUE INDEX "LiveQuizPendingResponse_responseKey_key"
ON "public"."LiveQuizPendingResponse"("responseKey");

CREATE INDEX "LiveQuizPendingResponse_nextDeliveryAt_idx"
ON "public"."LiveQuizPendingResponse"("nextDeliveryAt");

ALTER TABLE "public"."LiveQuizPendingResponse"
ADD CONSTRAINT "LiveQuizPendingResponse_liveQuizId_fkey"
FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
