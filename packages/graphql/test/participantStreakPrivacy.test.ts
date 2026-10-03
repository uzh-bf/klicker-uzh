import { UserRole } from '@klicker-uzh/prisma/client'
import type { GraphQLObjectType } from 'graphql'
import { describe, expect, it } from 'vitest'
import { schema } from '@/index.js'

const participation = {
  participantId: 'participant-id',
  courseId: 'course-id',
  studyStreakCurrent: 4,
  studyStreakLongest: 8,
  studyStreakFreezeBalance: 2,
  studyStreakLastQualifiedDate: new Date(),
}

async function resolveStudyStreakField(
  fieldName: string,
  user: { role: UserRole; sub: string }
) {
  const participationType = schema.getType('Participation') as GraphQLObjectType
  const field = participationType.getFields()[fieldName]

  return await field!.resolve!(
    participation,
    {},
    { user, prisma: {} },
    {} as never
  )
}

describe('Participation study streak privacy', () => {
  it('returns null for every private streak field to a lecturer', async () => {
    const lecturer = { role: UserRole.USER, sub: 'lecturer-id' }

    for (const fieldName of [
      'studyStreakCurrent',
      'studyStreakLongest',
      'studyStreakFreezeBalance',
      'studyStreakResponsesRemainingToday',
      'studyStreakQualifiedToday',
    ]) {
      await expect(
        resolveStudyStreakField(fieldName, lecturer)
      ).resolves.toBeNull()
    }
  })

  it('returns stored streak values to the owning participant', async () => {
    const owner = {
      role: UserRole.PARTICIPANT,
      sub: participation.participantId,
    }

    await expect(
      resolveStudyStreakField('studyStreakCurrent', owner)
    ).resolves.toBe(4)
    await expect(
      resolveStudyStreakField('studyStreakLongest', owner)
    ).resolves.toBe(8)
    await expect(
      resolveStudyStreakField('studyStreakFreezeBalance', owner)
    ).resolves.toBe(2)
  })
})
