-- CreateTable
CREATE TABLE "LiveQuizResponseExportLabel" (
    "identityHash" TEXT NOT NULL,
    "label" INTEGER NOT NULL,
    "liveQuizId" UUID NOT NULL,

    CONSTRAINT "LiveQuizResponseExportLabel_pkey" PRIMARY KEY ("liveQuizId","identityHash"),
    CONSTRAINT "LiveQuizResponseExportLabel_label_positive" CHECK ("label" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuizResponseExportLabel_liveQuizId_label_key" ON "LiveQuizResponseExportLabel"("liveQuizId", "label");

-- AddForeignKey
ALTER TABLE "LiveQuizResponseExportLabel" ADD CONSTRAINT "LiveQuizResponseExportLabel_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
