import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { allowCoursePurgeInTransaction, prisma } from '@klicker-uzh/prisma'
import { updateAssessmentParticipantIdentity } from '../src/lib/assessmentIdentity.ts'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the assessment identity smoke')
}

const databaseUrl = new URL(process.env.DATABASE_URL)
const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost'])
const isDevrouterDatabase =
  databaseUrl.hostname === 'postgres' &&
  process.env.DEVROUTER_WORKSPACE &&
  process.env.NODE_ENV !== 'production'

if (!loopbackHosts.has(databaseUrl.hostname) && !isDevrouterDatabase) {
  throw new Error(
    `Refusing to run the assessment identity smoke against non-local host ${databaseUrl.hostname}`
  )
}

const suffix = randomUUID().replaceAll('-', '')
const fixtureIds: {
  courseIds: string[]
  participantIds: string[]
  userId?: string
} = { courseIds: [], participantIds: [] }

try {
  const owner = await prisma.user.create({
    data: {
      email: `assessment-identity-owner-${suffix}@example.invalid`,
      name: 'Assessment identity smoke owner',
      shortname: `identity_${suffix.slice(0, 16)}`,
    },
  })
  fixtureIds.userId = owner.id

  const courseDates = {
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.000Z'),
    groupDeadlineDate: new Date('2026-01-01T00:00:00.000Z'),
  }
  const assessmentCourse = await prisma.course.create({
    data: {
      ...courseDates,
      name: `assessment-identity-${suffix}`,
      displayName: 'Assessment identity smoke course',
      authType: 'SSO',
      isAssessmentEnabled: true,
      ownerId: owner.id,
    },
  })
  fixtureIds.courseIds.push(assessmentCourse.id)
  const ordinaryCourse = await prisma.course.create({
    data: {
      ...courseDates,
      name: `ordinary-identity-${suffix}`,
      displayName: 'Ordinary identity smoke course',
      authType: 'SSO',
      isAssessmentEnabled: false,
      ownerId: owner.id,
    },
  })
  fixtureIds.courseIds.push(ordinaryCourse.id)

  const existingParticipant = await prisma.participant.create({
    data: {
      email: `assessment-identity-existing-${suffix}@example.invalid`,
      password: 'not-used',
      username: `identity-existing-${suffix}`,
      participations: {
        create: [
          { courseId: assessmentCourse.id },
          { courseId: ordinaryCourse.id },
        ],
      },
    },
  })
  fixtureIds.participantIds.push(existingParticipant.id)

  const firstUpdate = await prisma.$transaction((tx) =>
    updateAssessmentParticipantIdentity(tx, existingParticipant.id, {
      given_name: '  Ada  ',
      family_name: ['  Lovelace  '],
      swissEduPersonMatriculationNumber: '  00-123-456  ',
    })
  )
  assert.equal(firstUpdate.count, 1)

  const existingParticipations = await prisma.participation.findMany({
    where: { participantId: existingParticipant.id },
    orderBy: { courseId: 'asc' },
  })
  const assessmentParticipation = existingParticipations.find(
    (participation) => participation.courseId === assessmentCourse.id
  )
  const ordinaryParticipation = existingParticipations.find(
    (participation) => participation.courseId === ordinaryCourse.id
  )
  assert.deepEqual(
    {
      givenName: assessmentParticipation?.assessmentGivenName,
      surname: assessmentParticipation?.assessmentSurname,
      matriculationNumber:
        assessmentParticipation?.assessmentMatriculationNumber,
    },
    {
      givenName: 'Ada',
      surname: 'Lovelace',
      matriculationNumber: '00-123-456',
    }
  )
  assert.deepEqual(
    {
      givenName: ordinaryParticipation?.assessmentGivenName,
      surname: ordinaryParticipation?.assessmentSurname,
      matriculationNumber: ordinaryParticipation?.assessmentMatriculationNumber,
    },
    { givenName: null, surname: null, matriculationNumber: null }
  )

  await prisma.$transaction((tx) =>
    updateAssessmentParticipantIdentity(tx, existingParticipant.id, {
      given_name: ['  Grace  '],
      family_name: '   ',
      swissEduPersonMatriculationNumber: ['  99-999-999  '],
    })
  )
  const refreshedParticipation = await prisma.participation.findUniqueOrThrow({
    where: {
      courseId_participantId: {
        courseId: assessmentCourse.id,
        participantId: existingParticipant.id,
      },
    },
  })
  assert.deepEqual(
    {
      givenName: refreshedParticipation.assessmentGivenName,
      surname: refreshedParticipation.assessmentSurname,
      matriculationNumber: refreshedParticipation.assessmentMatriculationNumber,
    },
    {
      givenName: 'Grace',
      surname: null,
      matriculationNumber: '99-999-999',
    }
  )

  await prisma.$transaction((tx) =>
    updateAssessmentParticipantIdentity(tx, existingParticipant.id, {})
  )
  const clearedParticipation = await prisma.participation.findUniqueOrThrow({
    where: {
      courseId_participantId: {
        courseId: assessmentCourse.id,
        participantId: existingParticipant.id,
      },
    },
  })
  assert.deepEqual(
    {
      givenName: clearedParticipation.assessmentGivenName,
      surname: clearedParticipation.assessmentSurname,
      matriculationNumber: clearedParticipation.assessmentMatriculationNumber,
    },
    { givenName: null, surname: null, matriculationNumber: null }
  )

  const newParticipant = await prisma.participant.create({
    data: {
      email: `assessment-identity-new-${suffix}@example.invalid`,
      password: 'not-used',
      username: `identity-new-${suffix}`,
    },
  })
  fixtureIds.participantIds.push(newParticipant.id)

  const beforeParticipation = await prisma.$transaction((tx) =>
    updateAssessmentParticipantIdentity(tx, newParticipant.id, {
      given_name: 'New',
      family_name: 'Student',
    })
  )
  assert.equal(beforeParticipation.count, 0)

  await prisma.participation.create({
    data: {
      courseId: assessmentCourse.id,
      participantId: newParticipant.id,
    },
  })
  const afterParticipation = await prisma.$transaction((tx) =>
    updateAssessmentParticipantIdentity(tx, newParticipant.id, {
      given_name: '  New  ',
      family_name: '  Student  ',
    })
  )
  assert.equal(afterParticipation.count, 1)
  await assert.doesNotReject(
    prisma.participation.findFirstOrThrow({
      where: {
        participantId: newParticipant.id,
        assessmentGivenName: 'New',
        assessmentSurname: 'Student',
      },
    })
  )

  console.log('Auth assessment identity persistence passed')
} finally {
  try {
    await prisma.$transaction(async (tx) => {
      await allowCoursePurgeInTransaction(tx)
      await tx.course.updateMany({
        where: { id: { in: fixtureIds.courseIds } },
        data: {
          deletionJobId: null,
          deletionRequestedById: null,
          deletionPendingAt: null,
          deleteDraftActivitiesOnDeletion: false,
          isDeleted: true,
          isDeletionPending: false,
        },
      })
      await tx.course.deleteMany({
        where: { id: { in: fixtureIds.courseIds } },
      })
    })
    await prisma.participant.deleteMany({
      where: { id: { in: fixtureIds.participantIds } },
    })
    if (fixtureIds.userId) {
      await prisma.user.deleteMany({ where: { id: fixtureIds.userId } })
    }
  } finally {
    await prisma.$disconnect()
  }
}
