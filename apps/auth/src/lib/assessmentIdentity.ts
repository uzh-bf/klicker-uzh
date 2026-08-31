import {
  normalizeIdentityValue,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'

export type AssessmentIdentityProfile = {
  given_name?: unknown
  family_name?: unknown
  swissEduPersonMatriculationNumber?: unknown
}

export async function updateAssessmentParticipantIdentity(
  tx: PrismaTransactionClient,
  participantId: string,
  profile: AssessmentIdentityProfile
) {
  return await tx.participation.updateMany({
    where: {
      participantId,
      course: { isAssessmentEnabled: true, isDeleted: false },
    },
    data: {
      assessmentGivenName: normalizeIdentityValue(profile.given_name),
      assessmentSurname: normalizeIdentityValue(profile.family_name),
      assessmentMatriculationNumber: normalizeIdentityValue(
        profile.swissEduPersonMatriculationNumber
      ),
    },
  })
}
