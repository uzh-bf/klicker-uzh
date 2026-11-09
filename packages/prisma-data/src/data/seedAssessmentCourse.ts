import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import * as Prisma from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import {
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import {
  COURSE_ID_TEST4 as COURSE_ID_ASSESSMENT,
  COURSE_ID_ASSESSMENT_ENDED,
  USER_ID_TEST,
} from './constants.js'

// The ongoing course issues reports with points only; the ended course issues
// reports with the peer comparison.
const ASSESSMENT_FIXTURES = [
  {
    courseId: COURSE_ID_ASSESSMENT,
    liveQuizId: '0d4b7c3d-0230-4f7b-b95a-319891171295',
    legacyLiveQuizId: '5840b720-a5fd-4f73-9081-22c06d0c4069',
    name: 'Completed Assessment Live Quiz',
    pinCode: 'ASM001',
  },
  {
    courseId: COURSE_ID_ASSESSMENT_ENDED,
    liveQuizId: '8b1e6f3a-9c27-4d5e-b0a4-6f2c1d8e9a73',
    legacyLiveQuizId: null,
    name: 'Ended Assessment Live Quiz',
    pinCode: 'ASM002',
  },
] as const
const PARTICIPANT_COUNT = 30
const QUIZ_STARTED_AT = new Date('2025-06-15T09:00:00.000Z')
const QUIZ_FINISHED_AT = new Date('2025-06-15T09:02:00.000Z')
const INVITATION_BASE_DATE = new Date('2025-05-15T09:00:00.000Z')

const RESPONSE_PROFILES = [
  { isCorrect: false, bonusPoints: 0, timeSpent: 110 },
  { isCorrect: true, bonusPoints: 0, timeSpent: 100 },
  { isCorrect: true, bonusPoints: 3, timeSpent: 70 },
  { isCorrect: true, bonusPoints: 6, timeSpent: 40 },
  { isCorrect: true, bonusPoints: 10, timeSpent: 15 },
] as const

const ASSESSMENT_ELEMENT_DATA = {
  name: 'Assessment mode basics',
  content: 'Select the correct statement about assessment mode.',
  explanation:
    'Assessment results are based on the points awarded for completed assessment activities.',
  type: Prisma.ElementType.SC,
  basePoints: true,
  pointsMultiplier: 1,
  options: {
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    displayMode: DisplayMode.LIST,
    choices: [
      {
        ix: 0,
        value: 'Assessment activities can award correctness points.',
        correct: true,
      },
      {
        ix: 1,
        value: 'Assessment activities never contribute to results.',
        correct: false,
      },
    ],
  },
} as const

function assessmentInvitationEmail(username: string, index: number) {
  return index % 3 === 0 ? `${username}@example.org` : `${username}@test.uzh.ch`
}

async function seedAssessmentCourse(prismaClient: Prisma.PrismaClient) {
  await requireDisposableDatabase(prismaClient)
  if (process.env.ENV !== 'development') {
    throw new Error('The assessment course fixture is development-only')
  }

  const usernames = Array.from(
    { length: PARTICIPANT_COUNT },
    (_, index) => `testuser${index + 1}`
  )
  const participants = await prismaClient.participant.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  })
  const participantsByUsername = new Map(
    participants.map((participant) => [participant.username, participant])
  )
  const orderedParticipants = usernames.map((username) =>
    participantsByUsername.get(username)
  )

  if (orderedParticipants.some((participant) => !participant)) {
    throw new Error(
      `Expected ${PARTICIPANT_COUNT} seeded participants before adding the assessment course fixture`
    )
  }

  for (const fixture of ASSESSMENT_FIXTURES) {
    await seedCompletedAssessmentQuiz(
      prismaClient,
      orderedParticipants,
      fixture
    )
  }
}

async function seedCompletedAssessmentQuiz(
  prismaClient: Prisma.PrismaClient,
  orderedParticipants: ({ id: string; username: string } | undefined)[],
  fixture: (typeof ASSESSMENT_FIXTURES)[number]
) {
  const assessmentElementId = await prismaClient.$transaction(
    async (tx) => {
      const assessmentCourse = await tx.course.findUnique({
        where: { id: fixture.courseId, isAssessmentEnabled: true },
        select: { id: true },
      })
      if (!assessmentCourse) {
        throw new Error('The seeded assessment course is missing')
      }

      if (fixture.legacyLiveQuizId) {
        await tx.liveQuiz.deleteMany({
          where: {
            id: fixture.legacyLiveQuizId,
            courseId: fixture.courseId,
          },
        })
      }

      const liveQuiz = await tx.liveQuiz.findUnique({
        where: { id: fixture.liveQuizId },
        include: {
          blocks: {
            orderBy: { order: 'asc' },
            include: {
              elements: {
                orderBy: { order: 'asc' },
                include: {
                  element: {
                    include: {
                      _count: { select: { elementInstances: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
      const block = liveQuiz?.blocks[0]
      const instance = block?.elements[0]
      if (
        !liveQuiz ||
        liveQuiz.courseId !== fixture.courseId ||
        liveQuiz.blocks.length !== 1 ||
        !block ||
        block.elements.length !== 1 ||
        !instance
      ) {
        throw new Error(
          'The seeded assessment live quiz does not have the expected single-question structure'
        )
      }

      await tx.liveQuiz.update({
        where: { id: liveQuiz.id },
        data: {
          name: fixture.name,
          displayName: fixture.name,
          description:
            'A completed assessment activity for testing results, point corrections, and performance reports.',
          pinCode: fixture.pinCode,
          status: Prisma.PublicationStatus.ENDED,
          reviewStatus: Prisma.ReviewStatus.REVIEWED,
          startedAt: QUIZ_STARTED_AT,
          finishedAt: QUIZ_FINISHED_AT,
          activeBlockId: null,
          pointsMultiplier: 1,
          defaultPoints: 10,
          defaultCorrectPoints: 10,
          maxBonusPoints: 10,
          timeToZeroBonus: 120,
          isGamificationEnabled: false,
          isAssessmentEnabled: true,
          isLiveQAEnabled: false,
          isConfusionFeedbackEnabled: false,
          isModerationEnabled: true,
          areInstancesOutdated: false,
        },
      })
      await tx.elementBlock.update({
        where: { id: block.id },
        data: {
          execution: 0,
          status: Prisma.ElementBlockStatus.EXECUTED,
          timeLimit: 120,
          startedAt: QUIZ_STARTED_AT,
          expiresAt: QUIZ_FINISHED_AT,
          closedAt: QUIZ_FINISHED_AT,
        },
      })

      const assessmentElement =
        instance.element._count.elementInstances === 1
          ? await tx.element.update({
              where: { id: instance.element.id },
              data: ASSESSMENT_ELEMENT_DATA,
            })
          : await tx.element.create({
              data: {
                ...ASSESSMENT_ELEMENT_DATA,
                ownerId: USER_ID_TEST,
              },
            })
      const correctCount = orderedParticipants.filter(
        (_, index) =>
          RESPONSE_PROFILES[index % RESPONSE_PROFILES.length]!.isCorrect
      ).length

      await tx.elementInstance.update({
        where: { id: instance.id },
        data: {
          elementType: assessmentElement.type,
          elementData: processElementData(assessmentElement),
          options: { basePoints: true, pointsMultiplier: 1 },
          element: { connect: { id: assessmentElement.id } },
          results: {
            choices: {
              0: correctCount,
              1: PARTICIPANT_COUNT - correctCount,
            },
            total: PARTICIPANT_COUNT,
          },
          anonymousResults: { choices: { 0: 0, 1: 0 }, total: 0 },
          instanceStatistics: {
            upsert: {
              create: {
                anonymousCorrectCount: 0,
                anonymousPartialCorrectCount: 0,
                anonymousWrongCount: 0,
                correctCount,
                partialCorrectCount: 0,
                wrongCount: PARTICIPANT_COUNT - correctCount,
                upvoteCount: 0,
                downvoteCount: 0,
                uniqueParticipantCount: PARTICIPANT_COUNT,
                averageTimeSpent: 67,
              },
              update: {
                anonymousCorrectCount: 0,
                anonymousPartialCorrectCount: 0,
                anonymousWrongCount: 0,
                correctCount,
                partialCorrectCount: 0,
                wrongCount: PARTICIPANT_COUNT - correctCount,
                upvoteCount: 0,
                downvoteCount: 0,
                uniqueParticipantCount: PARTICIPANT_COUNT,
                averageTimeSpent: 67,
              },
            },
          },
        },
      })

      for (const [index, participant] of orderedParticipants.entries()) {
        if (!participant) continue

        const invitationDate = new Date(
          INVITATION_BASE_DATE.getTime() + index * 60_000
        )
        const invitationEmail = assessmentInvitationEmail(
          participant.username,
          index
        )
        await tx.participation.upsert({
          where: {
            courseId_participantId: {
              courseId: fixture.courseId,
              participantId: participant.id,
            },
          },
          create: {
            courseId: fixture.courseId,
            participantId: participant.id,
            isActive: true,
          },
          update: { isActive: true },
        })
        await tx.participantInvitation.upsert({
          where: {
            email_courseId: {
              email: invitationEmail,
              courseId: fixture.courseId,
            },
          },
          create: {
            email: invitationEmail,
            courseId: fixture.courseId,
            participantId: participant.id,
            status: Prisma.InvitationStatus.ACCEPTED,
            invitedAt: invitationDate,
            acceptedAt: invitationDate,
          },
          update: {
            participantId: participant.id,
            status: Prisma.InvitationStatus.ACCEPTED,
            acceptedAt: invitationDate,
          },
        })

        const profile = RESPONSE_PROFILES[index % RESPONSE_PROFILES.length]!
        await tx.liveQuizResponse.upsert({
          where: {
            instanceId_elementBlockExecution_participantId: {
              instanceId: instance.id,
              elementBlockExecution: 0,
              participantId: participant.id,
            },
          },
          create: {
            submittedAt: new Date(
              QUIZ_STARTED_AT.getTime() + profile.timeSpent * 1_000
            ),
            response: {
              choices: [
                { ix: 0, selected: profile.isCorrect },
                { ix: 1, selected: !profile.isCorrect },
              ],
            },
            timeSpent: profile.timeSpent,
            correctness: profile.isCorrect
              ? Prisma.ResponseCorrectness.CORRECT
              : Prisma.ResponseCorrectness.WRONG,
            basePoints: 10,
            correctnessPoints: profile.isCorrect ? 10 : 0,
            bonusPoints: profile.bonusPoints,
            elementBlockExecution: 0,
            instanceId: instance.id,
            participantId: participant.id,
          },
          // Preserve any point corrections made while manually testing.
          update: {},
        })
      }

      return assessmentElement.id
    },
    { timeout: 30_000 }
  )

  await recomputeDerivedPermissions(
    { elementId: assessmentElementId, userId: USER_ID_TEST },
    prismaClient
  )
  await recomputeDerivedPermissions(
    { liveQuizId: fixture.liveQuizId, userId: USER_ID_TEST },
    prismaClient
  )
}

await seedAssessmentCourse(prisma)
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
