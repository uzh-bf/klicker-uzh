import {
  CourseAuthType,
  CredentialStatus,
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  InvitationStatus,
  PermissionLevel,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type {
  ChoicesElementData,
  ElementInstanceOptions,
  ElementInstanceResults,
} from '@klicker-uzh/types'
import bcrypt from 'bcryptjs'
import { getPrisma } from '../global-setup.js'
import {
  ASSESSMENT_REPORT_COURSE_NAME,
  ASSESSMENT_REPORT_COURSE_REFERENCE,
  ASSESSMENT_REPORT_EDUID_EMAIL,
  ASSESSMENT_REPORT_EDUID_GIVEN_NAME,
  ASSESSMENT_REPORT_EDUID_MATRICULATION_NUMBER,
  ASSESSMENT_REPORT_EDUID_SURNAME,
  ASSESSMENT_REPORT_PARTICIPANT_IDS,
  ASSESSMENT_REPORT_SUBJECT_EMAIL,
  ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS,
  COURSE_ID_ASSESSMENT_REPORT,
  LIVE_QUIZ_ID_ASSESSMENT_REPORT,
  USER_ID_TEST,
} from './constants.js'

export async function seedAssessmentReportFixture() {
  const prisma = await getPrisma()
  const currentYear = new Date().getUTCFullYear()
  const participantPassword = await bcrypt.hash('abcdabcd', 12)

  await prisma.course.create({
    data: {
      id: COURSE_ID_ASSESSMENT_REPORT,
      name: ASSESSMENT_REPORT_COURSE_REFERENCE,
      displayName: ASSESSMENT_REPORT_COURSE_NAME,
      description: 'Deterministic assessment report browser fixture.',
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      authType: CourseAuthType.SSO,
      color: '#0028A5',
      startDate: new Date(`${currentYear - 1}-01-01T00:00`),
      endDate: new Date(`${currentYear + 10}-01-01T23:59`),
      isGroupCreationEnabled: false,
      groupDeadlineDate: new Date(`${currentYear - 1}-01-01T00:00`),
      owner: { connect: { id: USER_ID_TEST } },
    },
  })
  await prisma.derivedPermission.create({
    data: {
      permissionLevel: PermissionLevel.OWNER,
      course: { connect: { id: COURSE_ID_ASSESSMENT_REPORT } },
      user: { connect: { id: USER_ID_TEST } },
    },
  })

  const participantFixtures = ASSESSMENT_REPORT_PARTICIPANT_IDS.map(
    (participantId, index) => {
      const username = `assessment-report-student-${index + 1}`
      return {
        participantId,
        username,
        email:
          index === 0
            ? ASSESSMENT_REPORT_EDUID_EMAIL
            : `${username}@example.org`,
        invitationEmail:
          index === 0
            ? ASSESSMENT_REPORT_SUBJECT_EMAIL
            : `${username}@example.org`,
      }
    }
  )

  await prisma.participant.createMany({
    data: participantFixtures.map(({ participantId, username, email }) => ({
      id: participantId,
      username,
      email,
      password: participantPassword,
    })),
  })
  await prisma.participation.createMany({
    data: participantFixtures.map(({ participantId }) => ({
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      participantId,
      isActive: true,
    })),
  })
  await prisma.participantInvitation.createMany({
    data: participantFixtures.map(({ participantId, invitationEmail }) => ({
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      participantId,
      email: invitationEmail,
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    })),
  })

  const reportElement = await prisma.element.create({
    data: {
      name: 'Assessment report score fixture',
      content: 'Select the correct answer.',
      explanation: 'Deterministic Playwright fixture.',
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'Incorrect', correct: false },
          { ix: 1, value: 'Correct', correct: true },
        ],
      },
      status: 'READY',
      type: ElementType.SC,
      ownerId: USER_ID_TEST,
    },
  })
  const reportElementData = {
    id: `${reportElement.id}-v${reportElement.version}`,
    elementId: reportElement.id,
    type: ElementType.SC,
    name: reportElement.name,
    content: reportElement.content,
    explanation: reportElement.explanation,
    basePoints: reportElement.basePoints,
    pointsMultiplier: reportElement.pointsMultiplier,
    options: reportElement.options,
  } as ChoicesElementData
  const initialResults: ElementInstanceResults = {
    choices: { '0': 0, '1': 0 },
    total: 0,
  }
  const startedAt = new Date(`${currentYear}-02-01T10:00:00.000Z`)
  const finishedAt = new Date(`${currentYear}-02-01T11:00:00.000Z`)
  const reportLiveQuiz = await prisma.liveQuiz.create({
    data: {
      id: LIVE_QUIZ_ID_ASSESSMENT_REPORT,
      name: 'Assessment report quiz',
      displayName: 'Assessment report quiz',
      description: 'Deterministic score source for report verification.',
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      isAssessmentEnabled: true,
      isGamificationEnabled: false,
      status: PublicationStatus.ENDED,
      pinCode: 'RPT123',
      startedAt,
      finishedAt,
      defaultPoints: 10,
      defaultCorrectPoints: 10,
      maxBonusPoints: 0,
      blocks: {
        create: {
          order: 0,
          execution: 0,
          status: ElementBlockStatus.EXECUTED,
          startedAt,
          closedAt: finishedAt,
          elements: {
            create: {
              type: ElementInstanceType.LIVE_QUIZ,
              elementId: reportElement.id,
              elementType: ElementType.SC,
              order: 0,
              options: {
                basePoints: true,
                pointsMultiplier: 1,
              } satisfies ElementInstanceOptions,
              elementData: reportElementData,
              results: initialResults,
              anonymousResults: initialResults,
              ownerId: USER_ID_TEST,
            },
          },
        },
      },
    },
    include: { blocks: { include: { elements: true } } },
  })
  const reportInstanceId = reportLiveQuiz.blocks[0]!.elements[0]!.id
  await prisma.liveQuizResponse.createMany({
    data: ASSESSMENT_REPORT_PARTICIPANT_IDS.map((participantId, index) => {
      const totalPoints = (index + 1) * 2
      return {
        submittedAt: finishedAt,
        response: {
          choices: [
            { ix: 0, selected: false },
            { ix: 1, selected: true },
          ],
        },
        timeSpent: 30,
        correctness: ResponseCorrectness.PARTIAL,
        basePoints: Math.min(totalPoints, 10),
        correctnessPoints: Math.max(totalPoints - 10, 0),
        bonusPoints: 0,
        instanceId: reportInstanceId,
        elementBlockExecution: 0,
        participantId,
      }
    }),
  })
}

async function cleanupAssessmentReportTenBinFixture() {
  const prisma = await getPrisma()
  await prisma.liveQuizResponse.deleteMany({
    where: {
      participantId: { in: ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS },
      instance: {
        elementBlock: { liveQuizId: LIVE_QUIZ_ID_ASSESSMENT_REPORT },
      },
    },
  })
  await prisma.participantInvitation.deleteMany({
    where: {
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      participantId: { in: ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS },
    },
  })
  await prisma.participation.deleteMany({
    where: {
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      participantId: { in: ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS },
    },
  })
  await prisma.participant.deleteMany({
    where: { id: { in: ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS } },
  })
}

export async function seedAssessmentReportTenBinFixture() {
  await cleanupAssessmentReportTenBinFixture()
  const prisma = await getPrisma()
  const participantPassword = await bcrypt.hash('abcdabcd', 12)
  const participantFixtures = ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS.map(
    (participantId, index) => {
      const username = `assessment-report-ten-bin-${index + 1}`
      return {
        participantId,
        username,
        email: `${username}@example.org`,
      }
    }
  )

  await prisma.participant.createMany({
    data: participantFixtures.map(({ participantId, username, email }) => ({
      id: participantId,
      username,
      email,
      password: participantPassword,
    })),
  })
  await prisma.participation.createMany({
    data: participantFixtures.map(({ participantId }) => ({
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      participantId,
      isActive: true,
    })),
  })
  await prisma.participantInvitation.createMany({
    data: participantFixtures.map(({ participantId, email }) => ({
      courseId: COURSE_ID_ASSESSMENT_REPORT,
      participantId,
      email,
      status: InvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    })),
  })

  const reportInstance = await prisma.elementInstance.findFirst({
    where: {
      elementBlock: { liveQuizId: LIVE_QUIZ_ID_ASSESSMENT_REPORT },
    },
    select: { id: true },
  })
  if (!reportInstance) {
    throw new Error('ASSESSMENT_REPORT_FIXTURE_INSTANCE_NOT_FOUND')
  }

  await prisma.liveQuizResponse.createMany({
    data: ASSESSMENT_REPORT_TEN_BIN_PARTICIPANT_IDS.map(
      (participantId, index) => {
        const bin = Math.floor(index / 3)
        const totalPoints = bin * 2 + 0.5 + (index % 3) * 0.5
        return {
          submittedAt: new Date(),
          response: {
            choices: [
              { ix: 0, selected: false },
              { ix: 1, selected: true },
            ],
          },
          timeSpent: 30,
          correctness: ResponseCorrectness.PARTIAL,
          basePoints: Math.min(totalPoints, 10),
          correctnessPoints: Math.max(totalPoints - 10, 0),
          bonusPoints: 0,
          instanceId: reportInstance.id,
          elementBlockExecution: 0,
          participantId,
        }
      }
    ),
  })
}

export async function resetAssessmentReportFixture() {
  const prisma = await getPrisma()
  await cleanupAssessmentReportTenBinFixture()
  await prisma.verifiableCredential.deleteMany({
    where: { courseId: COURSE_ID_ASSESSMENT_REPORT },
  })
  await prisma.liveQuizResponse.updateMany({
    where: {
      participantId: ASSESSMENT_REPORT_PARTICIPANT_IDS[0],
      instance: {
        elementBlock: { liveQuizId: LIVE_QUIZ_ID_ASSESSMENT_REPORT },
      },
    },
    data: { basePoints: 2, correctnessPoints: 0, bonusPoints: 0 },
  })
  await prisma.course.update({
    where: { id: COURSE_ID_ASSESSMENT_REPORT },
    data: { displayName: ASSESSMENT_REPORT_COURSE_NAME },
  })
  await prisma.participant.update({
    where: { id: ASSESSMENT_REPORT_PARTICIPANT_IDS[0] },
    data: { email: ASSESSMENT_REPORT_EDUID_EMAIL },
  })
  await prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId: COURSE_ID_ASSESSMENT_REPORT,
        participantId: ASSESSMENT_REPORT_PARTICIPANT_IDS[0]!,
      },
    },
    data: {
      assessmentGivenName: null,
      assessmentSurname: null,
      assessmentMatriculationNumber: null,
    },
  })
}

export async function enableAssessmentReportEduIdIdentity() {
  const prisma = await getPrisma()
  await prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId: COURSE_ID_ASSESSMENT_REPORT,
        participantId: ASSESSMENT_REPORT_PARTICIPANT_IDS[0]!,
      },
    },
    data: {
      assessmentGivenName: ASSESSMENT_REPORT_EDUID_GIVEN_NAME,
      assessmentSurname: ASSESSMENT_REPORT_EDUID_SURNAME,
      assessmentMatriculationNumber:
        ASSESSMENT_REPORT_EDUID_MATRICULATION_NUMBER,
    },
  })
}

export async function changeAssessmentReportCourseDisplayName(
  displayName: string
) {
  const prisma = await getPrisma()
  await prisma.course.update({
    where: { id: COURSE_ID_ASSESSMENT_REPORT },
    data: { displayName },
  })
}

export async function changeAssessmentReportSubjectScore() {
  const prisma = await getPrisma()
  const result = await prisma.liveQuizResponse.updateMany({
    where: {
      participantId: ASSESSMENT_REPORT_PARTICIPANT_IDS[0],
      instance: {
        elementBlock: { liveQuizId: LIVE_QUIZ_ID_ASSESSMENT_REPORT },
      },
    },
    data: { basePoints: 3 },
  })
  if (result.count !== 1) {
    throw new Error('ASSESSMENT_REPORT_FIXTURE_RESPONSE_NOT_FOUND')
  }
}

export async function getAssessmentReportRecords() {
  const prisma = await getPrisma()
  return await prisma.verifiableCredential.findMany({
    where: { courseId: COURSE_ID_ASSESSMENT_REPORT },
    orderBy: { issuedAt: 'asc' },
  })
}

export async function expectOneActiveAssessmentReport() {
  const records = await getAssessmentReportRecords()
  const active = records.filter(
    (record) => record.status === CredentialStatus.ACTIVE
  )
  if (active.length !== 1) {
    throw new Error(`EXPECTED_ONE_ACTIVE_REPORT_GOT_${active.length}`)
  }
  return active[0]!
}
