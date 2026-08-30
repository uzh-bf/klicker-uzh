import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementType,
  PeerInstructionPhase,
  type PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { ContextWithUser } from '../src/lib/context.js'
import { manipulateLiveQuiz } from '../src/services/liveQuizzes.js'
import { createActivityTemplate } from '../src/services/templates.js'
import { initializePrisma, testCleanup, testInitialization } from './helpers.js'

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

  async function createPeerInstructionLiveQuiz() {
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
            isPeerInstructionEnabled: true,
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

  it('preserves preparation while clearing runtime state on edit', async () => {
    const liveQuiz = await createPeerInstructionLiveQuiz()
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
    const liveQuiz = await createPeerInstructionLiveQuiz()
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
  })
})
