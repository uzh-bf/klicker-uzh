/*
  Warnings:

  - Added the required column `authType` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."CourseAuthType" AS ENUM ('SSO', 'PIN');

-- AlterTable
ALTER TABLE "public"."Course" ADD COLUMN     "authType" "public"."CourseAuthType" NOT NULL DEFAULT 'PIN';

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
