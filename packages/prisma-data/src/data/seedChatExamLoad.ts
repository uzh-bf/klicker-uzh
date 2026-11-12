// Synthetic fixture for the chat exam load harness (util/load-test/chat-exam.js).
// Creates one course, one PUBLISHED chatbot with a disclaimer, N synthetic
// participants with participations, accepted disclaimers and credits, and BASE
// usage headroom for the course owner. All identifiers are fixed and
// synthetic so the k6 scenario can derive them without reading the database.
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import * as Prisma from '@klicker-uzh/prisma/client'
import {
  getZurichMonthStart,
  isChatUsageClassEntitled,
} from '@klicker-uzh/util'
import { USER_ID_TEST } from './constants.js'
import { prepareCourse } from './helpers.js'

const FIXTURE_NAME = 'chat exam load fixture'
const COURSE_ID = 'e0e0e0e0-0000-4000-8000-00000000c001'
const CHATBOT_ID = 'e0e0e0e0-0000-4000-8000-00000000c002'
const DISCLAIMER_ID = 'e0e0e0e0-0000-4000-8000-00000000c003'
const COURSE_PIN_CODE = 987640000
const FIRST_PARTICIPANT = 100
const DEFAULT_PARTICIPANT_COUNT = 100
const MAX_PARTICIPANT_COUNT = 125
// Not a valid hash, so no password can ever match it.
const LOGIN_DISABLED = '!'
// Far above what the scenario can spend, so owner budget never ends a run.
const HEADROOM_CREDITS = 1_000_000

// Mirrors participantId() in util/load-test/chat-exam.js.
function participantId(index: number) {
  return `e0e0e0e0-0000-4000-8000-${(0xe00000 + index).toString(16).padStart(12, '0')}`
}

async function seedChatExamLoad() {
  if (process.env.ENV !== 'development') {
    throw new Error(`The ${FIXTURE_NAME} is available only in development.`)
  }
  await requireDisposableDatabase(prisma)

  const count = Number(
    process.env.CHAT_EXAM_LOAD_PARTICIPANTS ?? DEFAULT_PARTICIPANT_COUNT
  )
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTICIPANT_COUNT) {
    throw new Error(
      `CHAT_EXAM_LOAD_PARTICIPANTS must be an integer from 1 through ${MAX_PARTICIPANT_COUNT}.`
    )
  }

  if (process.env.CHAT_EXAM_LOAD_WRITE !== 'true') {
    console.log(
      `Dry run only. Set CHAT_EXAM_LOAD_WRITE=true to write ${count} synthetic participants.`
    )
    return
  }

  const owner = await prisma.user.findUnique({
    where: { id: USER_ID_TEST },
    select: {
      id: true,
      aiFeaturesEnabled: true,
      aiSubscriptionTier: true,
      aiChatbotCostCenter: true,
    },
  })
  if (!owner) {
    throw new Error(
      `The development lecturer ${USER_ID_TEST} must exist before seeding the ${FIXTURE_NAME}.`
    )
  }

  // The selected model decides the usage class, so the owner needs both.
  for (const usageClass of ['BASE', 'ADVANCED'] as const) {
    if (!isChatUsageClassEntitled({ usageClass, ...owner })) {
      throw new Error(
        `The development lecturer ${USER_ID_TEST} is not entitled to ${usageClass} chat usage (needs aiFeaturesEnabled, and for ADVANCED the ADVANCED tier plus aiChatbotCostCenter); chat turns would be rejected.`
      )
    }
  }

  const existingCourse = await prisma.course.findUnique({
    where: { id: COURSE_ID },
    select: { ownerId: true },
  })
  if (existingCourse && existingCourse.ownerId !== USER_ID_TEST) {
    throw new Error(`Course ${COURSE_ID} belongs to another owner.`)
  }

  await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID,
      name: 'Chat exam load fixture',
      displayName: 'Chat exam load fixture',
      description: 'Development-only course for the chat exam load harness.',
      isGamificationEnabled: false,
      isAssessmentEnabled: true,
      isGroupCreationEnabled: false,
      ownerId: USER_ID_TEST,
      color: '#016272',
      pinCode: COURSE_PIN_CODE,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2030-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2029-12-01T00:00:00.000Z'),
      maxGroupSize: 5,
      preferredGroupSize: 3,
    })
  )

  await prisma.chatbotDisclaimer.upsert({
    where: { id: DISCLAIMER_ID },
    update: {},
    create: {
      id: DISCLAIMER_ID,
      name: 'Chat exam load disclaimer',
      title: 'Synthetic disclaimer',
      introText: 'Synthetic load-test disclaimer.',
      ownerId: USER_ID_TEST,
    },
  })

  const chatbotData = {
    name: 'Chat exam load bot',
    description: 'Synthetic chatbot for load testing.',
    systemPrompts: {
      tutor: { prompt: 'You are a concise tutor.', description: 'Tutor' },
    },
    modelSelection: true,
    allowedModelIds: [],
    status: Prisma.ChatbotStatus.PUBLISHED,
    publishedAt: new Date(),
    disclaimerId: DISCLAIMER_ID,
    creditInitialCredits: HEADROOM_CREDITS,
    creditResetAmount: HEADROOM_CREDITS,
    creditMaxCredits: HEADROOM_CREDITS,
  }
  await prisma.chatbot.upsert({
    where: { id: CHATBOT_ID },
    update: chatbotData,
    create: {
      ...chatbotData,
      id: CHATBOT_ID,
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID,
    },
  })

  // Owner headroom for the current Europe/Zurich month; both classes so the
  // fixture works whichever class the selected model carries.
  const monthStart = getZurichMonthStart(new Date())
  for (const usageClass of [
    Prisma.ChatUsageClass.BASE,
    Prisma.ChatUsageClass.ADVANCED,
  ]) {
    await prisma.chatAccountUsage.upsert({
      where: {
        ownerId_usageClass_monthStart: {
          ownerId: USER_ID_TEST,
          usageClass,
          monthStart,
        },
      },
      update: { budgetCredits: HEADROOM_CREDITS, usedCredits: 0 },
      create: {
        ownerId: USER_ID_TEST,
        usageClass,
        monthStart,
        budgetCredits: HEADROOM_CREDITS,
      },
    })
  }

  const now = new Date()
  for (let offset = 0; offset < count; offset++) {
    const index = FIRST_PARTICIPANT + offset
    const id = participantId(index)
    // The password is not a valid hash: the harness authenticates through
    // signed embed tokens and never logs in.
    await prisma.participant.upsert({
      where: { id },
      update: {},
      create: {
        id,
        username: `examload${index}`,
        password: LOGIN_DISABLED,
        isActive: true,
        isProfilePublic: false,
      },
    })
    await prisma.participation.upsert({
      where: {
        courseId_participantId: { courseId: COURSE_ID, participantId: id },
      },
      update: {},
      create: { courseId: COURSE_ID, participantId: id, isActive: true },
    })
    await prisma.chatUsageCredits.upsert({
      where: {
        participantId_chatbotId: { participantId: id, chatbotId: CHATBOT_ID },
      },
      update: {
        current: HEADROOM_CREDITS,
        total: HEADROOM_CREDITS,
        acceptedDisclaimerId: DISCLAIMER_ID,
        disclaimerAcceptedAt: now,
        disclaimerDeclined: false,
      },
      create: {
        participantId: id,
        chatbotId: CHATBOT_ID,
        current: HEADROOM_CREDITS,
        total: HEADROOM_CREDITS,
        periodStartedAt: now,
        acceptedDisclaimerId: DISCLAIMER_ID,
        disclaimerAcceptedAt: now,
      },
    })
  }

  console.log(
    `Seeded ${COURSE_ID} / ${CHATBOT_ID} with ${count} participants (indices ${FIRST_PARTICIPANT}-${FIRST_PARTICIPANT + count - 1}).`
  )
}

await seedChatExamLoad()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
