CREATE TABLE "public"."LiveQuizPendingResponse" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liveQuizId" UUID NOT NULL,

    CONSTRAINT "LiveQuizPendingResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveQuizPendingResponse_liveQuizId_idx"
ON "public"."LiveQuizPendingResponse"("liveQuizId");

ALTER TABLE "public"."LiveQuizPendingResponse"
ADD CONSTRAINT "LiveQuizPendingResponse_liveQuizId_fkey"
FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
