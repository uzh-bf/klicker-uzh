-- CreateEnum
CREATE TYPE "public"."CourseAuthType" AS ENUM ('SSO', 'PIN');

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "authType" "public"."CourseAuthType" NOT NULL DEFAULT 'PIN';

-- Update existing courses to have no pinCode if assessment mode is enabled
UPDATE "public"."Course" SET "pinCode" = NULL WHERE "isAssessmentEnabled" = true;

-- Update existing courses to have SSO authType if assessment mode is enabled
UPDATE "public"."Course" SET "authType" = 'SSO' WHERE "isAssessmentEnabled" = true;

-- Enforce pinCode based on authType
ALTER TABLE "public"."Course"
ADD CONSTRAINT "Course_pin_required_when_pin_auth"
CHECK ("authType" <> 'PIN'::"public"."CourseAuthType" OR "pinCode" IS NOT NULL OR "isArchived");

ALTER TABLE "public"."Course"
ADD CONSTRAINT "Course_pin_null_when_sso_auth"
CHECK ("authType" <> 'SSO'::"public"."CourseAuthType" OR "pinCode" IS NULL);

-- Enforce SSO when assessment mode is enabled
ALTER TABLE "public"."Course"
ADD CONSTRAINT "Course_assessment_requires_sso"
CHECK (NOT "isAssessmentEnabled" OR "authType" = 'SSO'::"public"."CourseAuthType");
