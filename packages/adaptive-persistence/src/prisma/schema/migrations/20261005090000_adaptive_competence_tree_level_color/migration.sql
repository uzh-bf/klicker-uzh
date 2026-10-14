-- Optional lecturer-chosen presentation color per competence tree level.
-- Additive and backward-compatible: existing levels keep NULL, which renders
-- the default ordinal palette. The color is cosmetic and never enters a
-- publication snapshot, scale version, or fingerprint.

-- AlterTable
ALTER TABLE "CompetenceTreeLevel" ADD COLUMN     "color" TEXT;

-- AddCheckConstraint
ALTER TABLE "CompetenceTreeLevel" ADD CONSTRAINT ctl_color_check CHECK (("color" IS NULL) OR ("color" ~ '^#[0-9a-f]{6}$'));
