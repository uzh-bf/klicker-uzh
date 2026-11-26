-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "tutorPersonalizationChoiceAt" TIMESTAMP(3),
ADD COLUMN     "tutorPersonalizationConsent" BOOLEAN,
ADD COLUMN     "tutorPersonalizationDisclosureVersion" TEXT;

-- AlterTable
ALTER TABLE "ParticipantDataUseEvent" ADD COLUMN     "tutorPersonalizationConsent" BOOLEAN,
ADD COLUMN     "tutorPersonalizationDisclosureVersion" TEXT;
