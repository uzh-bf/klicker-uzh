-- CreateTable
CREATE TABLE "LiveQuizResponseExportLabel" (
    "id" SERIAL NOT NULL,
    "identityHash" TEXT NOT NULL,
    "label" INTEGER NOT NULL,
    "liveQuizId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveQuizResponseExportLabel_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveQuizResponseExportLabel_label_positive" CHECK ("label" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuizResponseExportLabel_liveQuizId_identityHash_key" ON "LiveQuizResponseExportLabel"("liveQuizId", "identityHash");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuizResponseExportLabel_liveQuizId_label_key" ON "LiveQuizResponseExportLabel"("liveQuizId", "label");

-- CreateIndex
CREATE INDEX "LiveQuizResponseExportLabel_liveQuizId_idx" ON "LiveQuizResponseExportLabel"("liveQuizId");

-- AddForeignKey
ALTER TABLE "LiveQuizResponseExportLabel" ADD CONSTRAINT "LiveQuizResponseExportLabel_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
