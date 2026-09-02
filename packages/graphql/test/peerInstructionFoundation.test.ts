import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementType,
  Locale,
  PeerInstructionPhase,
  type PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { ContextWithUser } from '../src/lib/context.js'
import { duplicateCourse } from '../src/services/courseDuplication.js'
import {
  cancelLiveQuiz,
  manipulateLiveQuiz,
} from '../src/services/liveQuizzes.js'
import {
  createActivityTemplate,
  createLiveQuizFromTemplate,
} from '../src/services/templates.js'
import {
  initializePrisma,
  seedCourse,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Peer Instruction foundation', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
  })

  afterEach(async () => await testCleanup(prisma))

  async function createPeerInstructionLiveQuiz(
    isPeerInstructionEnabled?: boolean
  ) {
    const element = await prisma.element.create({
      data: {
        type: ElementType.SC,
        name: 'Peer Instruction question',
        content: 'Question content',
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
          displayMode: 'LIST',
          choices: [
            { ix: 0, value: 'Correct', correct: true },
            { ix: 1, value: 'Incorrect', correct: false },
          ],
        },
        ownerId: userOneCtx.user.sub,
      },
    })
    await recomputeDerivedPermissions(
      { elementId: element.id, userId: userOneCtx.user.sub },
      prisma
    )

    return manipulateLiveQuiz(
      {
        name: 'peer-instruction-quiz',
        displayName: 'Peer Instruction quiz',
        blocks: [
          {
            order: 0,
            timeLimit: 60,
            ...(typeof isPeerInstructionEnabled === 'boolean'
              ? { isPeerInstructionEnabled }
              : {}),
            elements: [
              {
                elementId: element.id,
                order: 0,
                existingInstanceId: null,
                duplicateInstance: false,
              },
            ],
          },
        ],
        multiplier: 1,
        isGamificationEnabled: false,
        isPinProtected: false,
        isConfusionFeedbackEnabled: false,
        isLiveQAEnabled: false,
        isModerationEnabled: false,
      },
      userOneCtx
    )
  }

  it('defaults preparation off for existing creation inputs', async () => {
    const liveQuiz = await createPeerInstructionLiveQuiz()
    const block = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: liveQuiz.id },
    })

    expect(block.isPeerInstructionEnabled).toBe(false)
    expect(block.peerInstructionPhase).toBe(PeerInstructionPhase.INACTIVE)
    expect(block.peerInstructionRun).toBeNull()
  })

  it('preserves preparation while clearing runtime state on edit', async () => {
    const liveQuiz = await createPeerInstructionLiveQuiz(true)
    const createdBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: liveQuiz.id },
      include: { elements: true },
    })
    const instance = createdBlock.elements[0]!

    expect(createdBlock.isPeerInstructionEnabled).toBe(true)
    expect(createdBlock.peerInstructionPhase).toBe(
      PeerInstructionPhase.INACTIVE
    )
    expect(createdBlock.peerInstructionRun).toBeNull()
    expect(instance.peerInstructionComparison).toBeNull()

    await prisma.elementBlock.update({
      where: { id: createdBlock.id },
      data: {
        peerInstructionPhase: PeerInstructionPhase.DISCUSSION,
        peerInstructionRun: {
          originalExecution: 0,
          attempt: 1,
          instanceIds: [instance.id],
          timeLimit: 60,
          revisionStartedAt: null,
          revisionEndsAt: null,
        },
      },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        peerInstructionComparison: {
          originalExecution: 0,
          attempt: 1,
          pairedResponseCount: 1,
          unpairedRevisedResponseCount: 0,
          initial: instance.results,
          revised: instance.results,
        },
      },
    })

    await manipulateLiveQuiz(
      {
        id: liveQuiz.id,
        name: liveQuiz.name,
        displayName: liveQuiz.displayName,
        blocks: [
          {
            order: 0,
            timeLimit: 90,
            isPeerInstructionEnabled: true,
            elements: [
              {
                elementId: instance.elementId,
                order: 0,
                existingInstanceId: instance.id,
                duplicateInstance: false,
              },
            ],
          },
        ],
        multiplier: 1,
        isGamificationEnabled: false,
        isPinProtected: false,
        isConfusionFeedbackEnabled: false,
        isLiveQAEnabled: false,
        isModerationEnabled: false,
      },
      userOneCtx
    )

    const editedBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: liveQuiz.id },
      include: { elements: true },
    })
    expect(editedBlock.isPeerInstructionEnabled).toBe(true)
    expect(editedBlock.peerInstructionPhase).toBe(PeerInstructionPhase.INACTIVE)
    expect(editedBlock.peerInstructionRun).toBeNull()
    expect(editedBlock.elements[0]?.peerInstructionComparison).toBeNull()
  })

  it.each([
    true,
    false,
  ])('copies only the preparation setting into templates (copy: %s)', async (copyBeforeConversion) => {
    const liveQuiz = await createPeerInstructionLiveQuiz(true)
    const sourceBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: liveQuiz.id },
      include: { elements: true },
    })
    const sourceInstance = sourceBlock.elements[0]!

    await prisma.elementBlock.update({
      where: { id: sourceBlock.id },
      data: {
        peerInstructionPhase: PeerInstructionPhase.COMPARISON_READY,
        peerInstructionRun: {
          originalExecution: 0,
          attempt: 1,
          instanceIds: [sourceInstance.id],
          timeLimit: 60,
          revisionStartedAt: null,
          revisionEndsAt: null,
        },
      },
    })
    await prisma.elementInstance.update({
      where: { id: sourceInstance.id },
      data: {
        peerInstructionComparison: {
          originalExecution: 0,
          attempt: 1,
          pairedResponseCount: 1,
          unpairedRevisedResponseCount: 0,
          initial: sourceInstance.results,
          revised: sourceInstance.results,
        },
      },
    })

    const created = await createActivityTemplate(
      {
        activityId: liveQuiz.id,
        activityType: ActivityType.LIVE_QUIZ,
        templateName: 'Peer Instruction template',
        templateDescription: '',
        templateInstructions: '',
        copyBeforeConversion,
      },
      userOneCtx
    )
    expect(created).toBe(true)

    const template = await prisma.liveQuiz.findFirstOrThrow({
      where: {
        name: 'Peer Instruction template',
        status: PublicationStatus.TEMPLATE,
      },
      include: {
        blocks: { include: { elements: true } },
      },
    })
    expect(template.blocks[0]?.isPeerInstructionEnabled).toBe(true)
    expect(template.blocks[0]?.peerInstructionPhase).toBe(
      PeerInstructionPhase.INACTIVE
    )
    expect(template.blocks[0]?.peerInstructionRun).toBeNull()
    expect(
      template.blocks[0]?.elements[0]?.peerInstructionComparison
    ).toBeNull()

    const activityTemplate = await prisma.activityTemplate.findFirstOrThrow({
      where: { liveQuizId: template.id },
    })
    const createdLiveQuizId = await createLiveQuizFromTemplate(
      {
        templateId: activityTemplate.id,
        name: 'quiz-from-peer-instruction-template',
        displayName: 'Quiz from Peer Instruction template',
        description: '',
        isGamificationEnabled: false,
        blocks: [
          {
            order: 0,
            timeLimit: 60,
            elements: [
              {
                order: 0,
                useExistingElement: true,
                existingElementId: sourceInstance.elementId,
                useNewElement: false,
              },
            ],
          },
        ],
      },
      userOneCtx
    )
    expect(createdLiveQuizId).not.toBeNull()

    const createdLiveQuizBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: createdLiveQuizId! },
      include: { elements: true },
    })
    expect(createdLiveQuizBlock.isPeerInstructionEnabled).toBe(true)
    expect(createdLiveQuizBlock.peerInstructionPhase).toBe(
      PeerInstructionPhase.INACTIVE
    )
    expect(createdLiveQuizBlock.peerInstructionRun).toBeNull()
    expect(
      createdLiveQuizBlock.elements[0]?.peerInstructionComparison
    ).toBeNull()
  })

  it('clears runtime state from every block when cancelling', async () => {
    const liveQuiz = await createPeerInstructionLiveQuiz(true)
    const block = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: liveQuiz.id },
      include: { elements: true },
    })
    const instance = block.elements[0]!

    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { status: PublicationStatus.PUBLISHED },
    })
    await prisma.elementBlock.update({
      where: { id: block.id },
      data: {
        peerInstructionPhase: PeerInstructionPhase.DISCUSSION,
        peerInstructionRun: {
          originalExecution: 0,
          attempt: 1,
          instanceIds: [instance.id],
          timeLimit: 60,
          revisionStartedAt: null,
          revisionEndsAt: null,
        },
      },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        peerInstructionComparison: {
          originalExecution: 0,
          attempt: 1,
          pairedResponseCount: 1,
          unpairedRevisedResponseCount: 0,
          initial: instance.results,
          revised: instance.results,
        },
      },
    })

    userOneCtx.redisExec = {
      keys: vi.fn().mockResolvedValue([]),
      multi: vi.fn().mockReturnValue({
        unlink: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ContextWithUser['redisExec']

    await cancelLiveQuiz({ id: liveQuiz.id }, userOneCtx)

    const cancelledBlock = await prisma.elementBlock.findUniqueOrThrow({
      where: { id: block.id },
      include: { elements: true },
    })
    expect(cancelledBlock.peerInstructionPhase).toBe(
      PeerInstructionPhase.INACTIVE
    )
    expect(cancelledBlock.peerInstructionRun).toBeNull()
    expect(cancelledBlock.elements[0]?.peerInstructionComparison).toBeNull()
  })

  it('copies preparation without runtime state during course duplication', async () => {
    const sourceCourse = await seedCourse({}, userOneCtx)
    const sourceLiveQuiz = await createPeerInstructionLiveQuiz(true)
    const sourceBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: sourceLiveQuiz.id },
      include: { elements: true },
    })
    const sourceInstance = sourceBlock.elements[0]!

    await prisma.liveQuiz.update({
      where: { id: sourceLiveQuiz.id },
      data: { courseId: sourceCourse.id },
    })
    await prisma.elementBlock.update({
      where: { id: sourceBlock.id },
      data: {
        peerInstructionPhase: PeerInstructionPhase.COMPARISON_READY,
        peerInstructionRun: {
          originalExecution: 0,
          attempt: 1,
          instanceIds: [sourceInstance.id],
          timeLimit: 60,
          revisionStartedAt: null,
          revisionEndsAt: null,
        },
      },
    })
    await prisma.elementInstance.update({
      where: { id: sourceInstance.id },
      data: {
        peerInstructionComparison: {
          originalExecution: 0,
          attempt: 1,
          pairedResponseCount: 1,
          unpairedRevisedResponseCount: 0,
          initial: sourceInstance.results,
          revised: sourceInstance.results,
        },
      },
    })
    await recomputeDerivedPermissions(
      { courseId: sourceCourse.id, userId: userOneCtx.user.sub },
      prisma
    )

    const startDate = new Date('2027-01-01T00:00:00.000Z')
    const endDate = new Date('2027-06-30T00:00:00.000Z')
    const duplicatedCourse = await duplicateCourse(
      {
        name: 'peer-instruction-course-copy',
        displayName: 'Peer Instruction course copy',
        startDate,
        endDate,
        groupDeadlineDate: endDate,
        isGroupCreationEnabled: false,
        maxGroupSize: 5,
        preferredGroupSize: 3,
        language: Locale.en,
        sourceCourseId: sourceCourse.id,
        duplicateLiveQuizzes: true,
        duplicatePracticeQuizzes: false,
        duplicateMicrolearnings: false,
        duplicateGroupActivities: false,
      },
      userOneCtx
    )
    expect(duplicatedCourse).not.toBeNull()

    const duplicatedBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuiz: { courseId: duplicatedCourse!.id } },
      include: { elements: true },
    })
    expect(duplicatedBlock.isPeerInstructionEnabled).toBe(true)
    expect(duplicatedBlock.peerInstructionPhase).toBe(
      PeerInstructionPhase.INACTIVE
    )
    expect(duplicatedBlock.peerInstructionRun).toBeNull()
    expect(duplicatedBlock.elements[0]?.peerInstructionComparison).toBeNull()
  })
})
