-- Immutable publication snapshots retain every same-root draft mapping.
ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD COLUMN "additionalLeafNodeIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
