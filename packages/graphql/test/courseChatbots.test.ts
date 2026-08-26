import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  ChatbotStatus,
  type PrismaClient,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { EventEmitter } from 'events'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import { getParticipantCourseChatbots } from '../src/services/chatbots.js'
import { getStudentMcpCoursePracticeQuiz } from '../src/services/courses.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Integration tests for the public courseChatbots query', () => {
  // shared resources used across tests
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()
    prisma = newPrisma
    hatchet = newHatchet
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const { userOneCtx: ctx1 } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = ctx1
  })

  afterEach(async () => await testCleanup(prisma))

  async function seedCourseWithChatbot() {
    const course = await seedCourse({}, userOneCtx)
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Course Tutor',
        courseId: course.id,
        ownerId: userOneCtx.user.sub,
        // The participant course-list query only returns PUBLISHED bots, so the
        // visibility tests below seed a published bot explicitly (new bots
        // default to DRAFT).
        status: ChatbotStatus.PUBLISHED,
      },
    })

    return { course, chatbot }
  }

  // participant tokens carry no scope (see createParticipantToken)
  function participantContext(participantId: string): ContextWithUser {
    return {
      ...userOneCtx,
      user: {
        sub: participantId,
        role: UserRole.PARTICIPANT,
      },
    } as unknown as ContextWithUser
  }

  it('returns an empty list for anonymous visitors instead of throwing', async () => {
    const { course } = await seedCourseWithChatbot()

    const chatbots = await getParticipantCourseChatbots(
      { courseId: course.id },
      { ...userOneCtx, user: undefined } as unknown as Context
    )

    expect(chatbots).toEqual([])
  })

  it('returns an empty list for a logged-in lecturer', async () => {
    const { course } = await seedCourseWithChatbot()

    // userOneCtx is the course owner, but has role USER (not PARTICIPANT)
    const chatbots = await getParticipantCourseChatbots(
      { courseId: course.id },
      userOneCtx as Context
    )

    expect(chatbots).toEqual([])
  })

  it('returns an empty list for a participant that is not enrolled in the course', async () => {
    const { course } = await seedCourseWithChatbot()
    const participant = await prisma.participant.create({
      data: { username: 'chatbotParticipantUnenrolled', password: 'not-used' },
    })

    const chatbots = await getParticipantCourseChatbots(
      { courseId: course.id },
      participantContext(participant.id)
    )

    expect(chatbots).toEqual([])
  })

  it('returns the course chatbots for an enrolled participant', async () => {
    const { course, chatbot } = await seedCourseWithChatbot()
    const participant = await prisma.participant.create({
      data: {
        username: 'chatbotParticipantEnrolled',
        password: 'not-used',
        participations: { create: [{ courseId: course.id }] },
      },
    })

    const chatbots = await getParticipantCourseChatbots(
      { courseId: course.id },
      participantContext(participant.id)
    )

    expect(chatbots).toEqual([
      {
        id: chatbot.id,
        name: 'Course Tutor',
        description: null,
        avatar: null,
      },
    ])
  })

  it('hides an unpublished chatbot from an enrolled participant', async () => {
    const course = await seedCourse({}, userOneCtx)
    // A DRAFT (unpublished) bot must never surface in a participant's course
    // overview, mirroring the chat-app access gate (S4 publication boundary).
    await prisma.chatbot.create({
      data: {
        name: 'Draft Tutor',
        courseId: course.id,
        ownerId: userOneCtx.user.sub,
        status: ChatbotStatus.DRAFT,
      },
    })
    const participant = await prisma.participant.create({
      data: {
        username: 'chatbotParticipantDraft',
        password: 'not-used',
        participations: { create: [{ courseId: course.id }] },
      },
    })

    const chatbots = await getParticipantCourseChatbots(
      { courseId: course.id },
      participantContext(participant.id)
    )

    expect(chatbots).toEqual([])
  })

  it('allows a leaderboard-inactive participant to load student MCP practice', async () => {
    const { course, chatbot } = await seedCourseWithChatbot()
    const participant = await prisma.participant.create({
      data: {
        username: 'studentMcpParticipantEnrolled',
        password: 'abcdabcd',
        participations: {
          create: [{ courseId: course.id, isActive: false }],
        },
      },
    })

    const quiz = await getStudentMcpCoursePracticeQuiz(
      { chatbotId: chatbot.id, courseId: course.id },
      participantContext(participant.id)
    )

    expect(quiz?.courseId).toBe(course.id)
    expect(
      await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId: course.id,
            participantId: participant.id,
          },
        },
        select: { isActive: true },
      })
    ).toEqual({ isActive: false })
  })

  it('rejects student MCP practice for a participant outside the course', async () => {
    const { course, chatbot } = await seedCourseWithChatbot()
    const participant = await prisma.participant.create({
      data: {
        username: 'studentMcpParticipantUnenrolled',
        password: 'abcdabcd',
      },
    })

    const quiz = await getStudentMcpCoursePracticeQuiz(
      { chatbotId: chatbot.id, courseId: course.id },
      participantContext(participant.id)
    )

    expect(quiz).toBeNull()
  })

  it('rejects student MCP practice when the chatbot belongs to another course', async () => {
    const { course } = await seedCourseWithChatbot()
    const { chatbot: otherChatbot } = await seedCourseWithChatbot()
    const participant = await prisma.participant.create({
      data: {
        username: 'studentMcpParticipantWrongChatbot',
        password: 'abcdabcd',
        participations: { create: [{ courseId: course.id }] },
      },
    })

    const quiz = await getStudentMcpCoursePracticeQuiz(
      { chatbotId: otherChatbot.id, courseId: course.id },
      participantContext(participant.id)
    )

    expect(quiz).toBeNull()
  })

  it('rejects student MCP practice for a lecturer', async () => {
    const { course, chatbot } = await seedCourseWithChatbot()

    const quiz = await getStudentMcpCoursePracticeQuiz(
      { chatbotId: chatbot.id, courseId: course.id },
      userOneCtx
    )

    expect(quiz).toBeNull()
  })
})
