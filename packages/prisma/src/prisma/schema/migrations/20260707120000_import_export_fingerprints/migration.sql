-- Add advisory duplicate-detection fingerprints for element import/export packages.
ALTER TABLE "Element" ADD COLUMN "importFingerprint" TEXT;
ALTER TABLE "AnswerCollection" ADD COLUMN "importFingerprint" TEXT;

CREATE INDEX "Element_ownerId_importFingerprint_idx" ON "Element"("ownerId", "importFingerprint");
CREATE INDEX "AnswerCollection_ownerId_importFingerprint_idx" ON "AnswerCollection"("ownerId", "importFingerprint");
