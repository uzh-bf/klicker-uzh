-- CreateIndex
CREATE UNIQUE INDEX CONCURRENTLY "LiveQuizResponse_instanceId_elementBlockExecution_responden_key"
ON "public"."LiveQuizResponse"("instanceId", "elementBlockExecution", "respondentId");
