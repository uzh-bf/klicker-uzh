-- IRT_V1 leaf coverage status reported by Catalyst routing SEQUENTIAL_ROOTS_V5
-- for the decision state each estimate was persisted with. Additive and
-- backward-compatible: the column is nullable, existing estimates and
-- estimates from engines that predate the field stay NULL, and the host keeps
-- its response-count breadth rules for them. Only subcompetence estimates may
-- carry a status.

-- CreateEnum
CREATE TYPE "AdaptiveLeafCoverageStatus" AS ENUM ('COVERED', 'OUT_OF_RANGE', 'SAMPLED_PENDING', 'NOT_SAMPLED');

-- AlterTable
ALTER TABLE "AdaptivePracticeQuizEstimate" ADD COLUMN     "coverageStatus" "AdaptiveLeafCoverageStatus";

-- AddCheckConstraint
ALTER TABLE "AdaptivePracticeQuizEstimate" ADD CONSTRAINT apqe_coverage_status_leaf_check CHECK ((("coverageStatus" IS NULL) OR ("nodeKind" = 'SUBCOMPETENCE'::"AdaptiveEstimateNodeKind")));
