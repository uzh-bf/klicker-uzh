import type { PrismaClient } from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  activateLiveQuizBlock,
  courseId,
  createCtx,
  createdElementIds,
  createdQuizIds,
  createUserCtx,
  getCockpitQuiz,
  getEscapeRoomProgress,
  getRunningLiveQuiz,
  lecturerCtx,
  manipulateGroupActivity,
  manipulateLiveQuiz,
  manipulateMicroLearning,
  manipulatePracticeQuiz,
  participantCtx,
  prisma,
  recomputeDerivedPermissions,
  requestEscapeRoomHint,
  resetEscapeRoomAttempt,
  scElement,
  schema,
  seedEscapeRoomLiveQuiz,
  seedEscapeRoomPracticeQuiz,
  seedEscapeRoomQuiz,
  seedLiveQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
  TEST_PREFIX,
} from './escapeRoomTestHarness.js'

describe('LiveQuiz block attempt start/reset contract', () => {
  it('does not broadcast escape-room question content when a block activates', async () => {
    const { liveQuiz, block } = await seedEscapeRoomLiveQuiz({
      active: false,
    })
    const publish = vi.fn()
    const redisPipeline = {
      hmset: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }

    await activateLiveQuizBlock(
      { quizId: liveQuiz.id, blockId: block.id },
      {
        ...lecturerCtx,
        pubSub: { ...lecturerCtx.pubSub, publish } as any,
        redisExec: { pipeline: () => redisPipeline } as any,
      }
    )

    expect(publish).toHaveBeenCalledWith(
      'runningLiveQuizUpdated',
      expect.objectContaining({
        activeBlock: expect.objectContaining({
          elements: [],
          escapeRoomTotalInstances: 1,
          escapeRoomClearedInstances: 0,
        }),
      })
    )
  })

  it('returns no locked question content and only the current live escape stage', async () => {
    const { liveQuiz, block } = await seedEscapeRoomLiveQuiz({
      includeSecondInstance: true,
    })
    const participant = await seedParticipant('live-stage-mask')
    const clearedIds: string[] = []
    const participantContext = participantCtx(participant.id)
    const ctx = {
      ...participantContext,
      redisExec: {
        ...participantContext.redisExec,
        smembers: vi.fn().mockImplementation(async () => clearedIds),
      } as any,
    }

    const beforeStart = await getRunningLiveQuiz({ id: liveQuiz.id }, ctx)
    expect(beforeStart?.activeBlock?.elements).toEqual([])
    expect(beforeStart?.activeBlock).toMatchObject({
      escapeRoomTotalInstances: 2,
      escapeRoomClearedInstances: 0,
    })
    const anonymous = await getRunningLiveQuiz(
      { id: liveQuiz.id },
      createCtx(undefined)
    )
    expect(anonymous?.activeBlock?.elements).toEqual([])
    const temporary = await getRunningLiveQuiz(
      { id: liveQuiz.id },
      createUserCtx('temporary-viewer', DB.UserRole.TEMPORARY_PARTICIPANT)
    )
    expect(temporary?.activeBlock?.elements).toEqual([])

    const attempt = await startEscapeRoomAttempt(
      { elementBlockId: block.id },
      ctx
    )
    const firstInstanceId = block.elements[0]!.id
    const secondInstanceId = block.elements[1]!.id
    const firstStage = await getRunningLiveQuiz({ id: liveQuiz.id }, ctx)
    expect(firstStage?.activeBlock?.elements?.map(({ id }) => id)).toEqual([
      firstInstanceId,
    ])

    clearedIds.push(String(firstInstanceId))
    const secondStage = await getRunningLiveQuiz({ id: liveQuiz.id }, ctx)
    expect(secondStage?.activeBlock?.elements?.map(({ id }) => id)).toEqual([
      secondInstanceId,
    ])
    expect(secondStage?.activeBlock).toMatchObject({
      escapeRoomTotalInstances: 2,
      escapeRoomClearedInstances: 1,
    })
    expect(
      await prisma.escapeRoomAttempt.findUnique({ where: { id: attempt.id } })
    ).not.toBeNull()
  })

  it('rejects a future LiveQuiz hint until the preceding stage is cleared', async () => {
    const { block } = await seedEscapeRoomLiveQuiz({
      includeSecondInstance: true,
      firstHint: 'first hint',
      secondHint: 'future hint',
      hintPenalty: 30,
    })
    const participant = await seedParticipant('live-hint-gate')
    const clearedIds: string[] = []
    const participantContext = participantCtx(participant.id)
    const ctx = {
      ...participantContext,
      redisExec: {
        ...participantContext.redisExec,
        smembers: vi.fn().mockImplementation(async () => clearedIds),
      } as any,
    }
    const attempt = await startEscapeRoomAttempt(
      { elementBlockId: block.id },
      ctx
    )

    await expect(
      requestEscapeRoomHint(
        { elementBlockId: block.id, instanceId: block.elements[1]!.id },
        ctx
      )
    ).rejects.toThrow(
      'You must answer all preceding questions correctly before requesting this hint'
    )
    expect(
      await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
    ).toMatchObject({ penaltySeconds: 0, hintsUsed: [] })

    await expect(
      requestEscapeRoomHint(
        { elementBlockId: block.id, instanceId: block.elements[0]!.id },
        ctx
      )
    ).resolves.toMatchObject({ hint: 'first hint' })

    clearedIds.push(String(block.elements[0]!.id))
    await expect(
      requestEscapeRoomHint(
        { elementBlockId: block.id, instanceId: block.elements[1]!.id },
        ctx
      )
    ).resolves.toMatchObject({ hint: 'future hint' })
  })

  it('round-trips escape-room block configuration through create and edit', async () => {
    await recomputeDerivedPermissions(
      { elementId: scElement.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const common = {
      name: `${TEST_PREFIX}-live-authoring`,
      displayName: 'Escape LiveQuiz',
      multiplier: 1,
      isGamificationEnabled: false,
      isPinProtected: false,
      isConfusionFeedbackEnabled: false,
      isLiveQAEnabled: false,
      isModerationEnabled: false,
      courseId: null,
    }
    const created = await manipulateLiveQuiz(
      {
        ...common,
        blocks: [
          {
            order: 0,
            isEscapeRoom: true,
            escapeRoomTimeLimit: 420,
            escapeRoomHintPenalty: 45,
            escapeRoomIntroText: 'Find the key.',
            elements: [
              {
                elementId: scElement.id,
                order: 0,
                existingInstanceId: null,
                duplicateInstance: false,
                escapeRoomHint: 'Look closely.',
              },
            ],
          },
        ],
      },
      lecturerCtx
    )
    createdQuizIds.push(created.id)

    const createdBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: created.id },
      include: { escapeRoomConfig: true, elements: true },
    })
    expect(createdBlock.escapeRoomConfig).toMatchObject({
      timeLimit: 420,
      hintPenalty: 45,
      introText: 'Find the key.',
    })
    expect(createdBlock.elements[0]?.options.escapeRoomHint).toBe(
      'Look closely.'
    )

    await manipulateLiveQuiz(
      {
        ...common,
        id: created.id,
        displayName: 'Edited Escape LiveQuiz',
        blocks: [
          {
            order: 0,
            isEscapeRoom: true,
            escapeRoomTimeLimit: 600,
            escapeRoomHintPenalty: 30,
            escapeRoomIntroText: 'Open the vault.',
            elements: [
              {
                elementId: scElement.id,
                order: 0,
                existingInstanceId: createdBlock.elements[0]!.id,
                duplicateInstance: false,
                escapeRoomHint: 'Try the first digit.',
              },
            ],
          },
        ],
      },
      lecturerCtx
    )

    const editedBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: created.id },
      include: { escapeRoomConfig: true, elements: true },
    })
    expect(editedBlock.escapeRoomConfig).toMatchObject({
      timeLimit: 600,
      hintPenalty: 30,
      introText: 'Open the vault.',
    })
    expect(editedBlock.elements[0]?.options.escapeRoomHint).toBe(
      'Try the first digit.'
    )
  })

  it('rejects empty and unsupported escape-room blocks', async () => {
    await recomputeDerivedPermissions(
      { elementId: scElement.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const common = {
      name: `${TEST_PREFIX}-invalid-live-escape`,
      displayName: 'Invalid Escape LiveQuiz',
      multiplier: 1,
      isGamificationEnabled: false,
      isPinProtected: false,
      isConfusionFeedbackEnabled: false,
      isLiveQAEnabled: false,
      isModerationEnabled: false,
      courseId: null,
    }
    await expect(
      manipulateLiveQuiz(
        {
          ...common,
          blocks: [{ order: 0, isEscapeRoom: true, elements: [] }],
        },
        lecturerCtx
      )
    ).rejects.toThrow('at least one question')

    const content = await prisma.element.create({
      data: {
        type: DB.ElementType.CONTENT,
        name: `${TEST_PREFIX}-content-element`,
        content: 'Unsupported content',
        explanation: '',
        options: {},
        ownerId: lecturerCtx.user.sub,
      },
    })
    createdElementIds.push(content.id)
    await recomputeDerivedPermissions(
      { elementId: content.id, userId: lecturerCtx.user.sub },
      prisma
    )
    await expect(
      manipulateLiveQuiz(
        {
          ...common,
          blocks: [
            {
              order: 0,
              isEscapeRoom: true,
              elements: [
                {
                  elementId: content.id,
                  order: 0,
                  existingInstanceId: null,
                  duplicateInstance: false,
                },
              ],
            },
          ],
        },
        lecturerCtx
      )
    ).rejects.toThrow('only support')

    const originalCourseAuth = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { authType: true, pinCode: true },
    })
    await prisma.course.update({
      where: { id: courseId },
      data: {
        isAssessmentEnabled: true,
        authType: DB.CourseAuthType.SSO,
        pinCode: null,
      },
    })
    try {
      await expect(
        manipulateLiveQuiz(
          {
            ...common,
            courseId,
            blocks: [
              {
                order: 0,
                isEscapeRoom: true,
                elements: [
                  {
                    elementId: scElement.id,
                    order: 0,
                    existingInstanceId: null,
                    duplicateInstance: false,
                  },
                ],
              },
            ],
          },
          lecturerCtx
        )
      ).rejects.toThrow('not supported in assessment')
    } finally {
      await prisma.course.update({
        where: { id: courseId },
        data: {
          isAssessmentEnabled: false,
          authType: originalCourseAuth.authType,
          pinCode: originalCourseAuth.pinCode,
        },
      })
    }
  })

  it('requires a regular participant start and permits only an authorized reset', async () => {
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: scElement.id, type: scElement.type }],
        status: DB.PublicationStatus.PUBLISHED,
        courseId,
      },
      lecturerCtx
    )
    const block = liveQuiz.blocks[0]!
    await prisma.escapeRoomConfig.create({
      data: { elementBlockId: block.id, timeLimit: 300 },
    })
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        activeBlockId: block.id,
        blocks: {
          update: {
            where: { id: block.id },
            data: { status: DB.ElementBlockStatus.ACTIVE },
          },
        },
      },
    })
    await recomputeDerivedPermissions(
      { liveQuizId: liveQuiz.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const redisPipeline = {
      hgetall: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, { participants: '0' }]]),
    }
    const cockpit = await getCockpitQuiz(
      { id: liveQuiz.id },
      {
        ...lecturerCtx,
        redisExec: { pipeline: () => redisPipeline } as any,
      }
    )
    expect(cockpit).toMatchObject({
      canResetEscapeRoom: true,
      activeBlock: {
        id: block.id,
        escapeRoomConfig: { timeLimit: 300 },
      },
    })
    const participant = await seedParticipant('live-block-start')
    const notStartedParticipant = await seedParticipant(
      'live-block-not-started'
    )

    await expect(
      startEscapeRoomAttempt(
        { elementBlockId: block.id },
        createUserCtx(participant.id, DB.UserRole.TEMPORARY_PARTICIPANT)
      )
    ).rejects.toThrow('Only participants can start escape room attempts')

    const started = await startEscapeRoomAttempt(
      { elementBlockId: block.id },
      participantCtx(participant.id)
    )
    expect(started).toMatchObject({
      participantId: participant.id,
      elementBlockId: block.id,
      status: DB.EscapeRoomStatus.IN_PROGRESS,
    })

    const progress = await getEscapeRoomProgress(
      { liveQuizId: liveQuiz.id, elementBlockId: block.id },
      lecturerCtx
    )
    expect(progress).toMatchObject({
      activityId: String(block.id),
      totalStacks: 1,
    })
    expect(progress?.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: started.id,
          participantId: participant.id,
          clearedStacks: 0,
        }),
        expect.objectContaining({
          id: null,
          participantId: notStartedParticipant.id,
          status: 'NOT_STARTED',
          clearedStacks: 0,
        }),
      ])
    )

    await prisma.escapeRoomAttempt.update({
      where: { id: started.id },
      data: {
        status: DB.EscapeRoomStatus.COMPLETED,
        completedAt: new Date(),
      },
    })
    const completedProgress = await getEscapeRoomProgress(
      { liveQuizId: liveQuiz.id, elementBlockId: block.id },
      lecturerCtx
    )
    expect(
      completedProgress?.attempts.find(
        (entry) => entry.participantId === participant.id
      )?.clearedStacks
    ).toBe(1)

    const foreignQuiz = await seedLiveQuiz(
      {
        elements: [{ id: scElement.id, type: scElement.type }],
        status: DB.PublicationStatus.PUBLISHED,
        courseId,
      },
      lecturerCtx
    )
    const foreignBlock = foreignQuiz.blocks[0]!
    await prisma.escapeRoomConfig.create({
      data: { elementBlockId: foreignBlock.id, timeLimit: 300 },
    })
    await expect(
      getEscapeRoomProgress(
        { liveQuizId: liveQuiz.id, elementBlockId: foreignBlock.id },
        lecturerCtx
      )
    ).resolves.toBeNull()

    await prisma.escapeRoomAttempt.update({
      where: { id: started.id },
      data: { status: DB.EscapeRoomStatus.IN_PROGRESS, completedAt: null },
    })

    await expect(
      resetEscapeRoomAttempt(
        { elementBlockId: block.id, participantId: participant.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Only lecturers can reset escape room attempts')

    await expect(
      resetEscapeRoomAttempt(
        { elementBlockId: block.id, participantId: participant.id },
        lecturerCtx
      )
    ).resolves.toBe(true)
    expect(
      await prisma.escapeRoomAttempt.findUnique({
        where: { id: started.id },
      })
    ).toBeNull()
  })
})

// ! SEC#1: status gate on escape attempt start/hint
// #region
describe('escape attempt status gate (SEC#1)', () => {
  it('rejects a start request that binds more than one activity', async () => {
    const practiceQuiz = await seedEscapeRoomQuiz(1)
    const { block } = await seedEscapeRoomLiveQuiz()
    const participant = await seedParticipant('start-multi-id')

    await expect(
      startEscapeRoomAttempt(
        { practiceQuizId: practiceQuiz.id, elementBlockId: block.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Exactly one activity ID must be specified')

    expect(
      await prisma.escapeRoomAttempt.count({
        where: { participantId: participant.id },
      })
    ).toBe(0)
  })

  it('rejects starting or hinting on an unpublished practice quiz for an enrolled participant', async () => {
    // an enrolled participant is authorized for the course but must still be
    // blocked from a scheduled (not-yet-published) escape room; the status
    // gate makes it indistinguishable from a missing quiz
    const quiz = await seedEscapeRoomPracticeQuiz(
      {
        elements: [scElement],
        courseId,
        status: DB.PublicationStatus.SCHEDULED,
      },
      lecturerCtx
    )
    createdQuizIds.push(quiz.id)
    const instanceId = quiz.stacks[0]!.elements[0]!.id
    const participant = await seedParticipant('gate-unpublished-pq')

    await expect(
      startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Practice quiz not found')

    // the hint path carries the same gate, so no hint leaks before publish
    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Practice quiz not found')

    expect(
      await prisma.escapeRoomAttempt.count({
        where: { practiceQuizId: quiz.id },
      })
    ).toBe(0)
  })

  it('rejects starting an escape attempt on a LiveQuiz block that is not active', async () => {
    // ElementBlock.id is a globally sequential, guessable integer. A block
    // that carries an escapeRoomConfig but has not been activated must reject
    // an attempt - existence of the config alone must never open the timer.
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: scElement.id, type: scElement.type }],
        status: DB.PublicationStatus.PUBLISHED,
        courseId,
      },
      lecturerCtx
    )
    const block = liveQuiz.blocks[0]!
    await prisma.escapeRoomConfig.create({
      data: { elementBlockId: block.id, timeLimit: 300 },
    })
    // deliberately leave the block in its default (non-ACTIVE) status
    const participant = await seedParticipant('gate-inactive-block')

    await expect(
      startEscapeRoomAttempt(
        { elementBlockId: block.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Block not found')

    expect(
      await prisma.escapeRoomAttempt.count({
        where: { elementBlockId: block.id },
      })
    ).toBe(0)
  })
})
// #endregion

describe('escape-room configuration validation', () => {
  const databaseAccessError = new Error('database accessed before validation')
  const rejectingPrisma = new Proxy({} as PrismaClient, {
    get() {
      throw databaseAccessError
    },
  })
  const rejectingCtx = () => ({
    ...lecturerCtx,
    prisma: rejectingPrisma,
  })
  const baseBlock = {
    order: 0,
    elements: [],
    isEscapeRoom: true,
  }

  const invalidInputs = [
    { timeLimit: 0, hintPenalty: 0 },
    { timeLimit: 300, hintPenalty: 3601 },
  ]

  for (const invalid of invalidInputs) {
    it.each([
      [
        'PracticeQuiz',
        () =>
          manipulatePracticeQuiz(
            {
              name: 'invalid escape room',
              displayName: 'invalid escape room',
              stacks: [],
              courseId,
              multiplier: 1,
              order: DB.ElementOrderType.SEQUENTIAL,
              resetTimeDays: 1,
              isEscapeRoom: true,
              escapeRoomTimeLimit: invalid.timeLimit,
              escapeRoomHintPenalty: invalid.hintPenalty,
            },
            rejectingCtx()
          ),
      ],
      [
        'MicroLearning',
        () =>
          manipulateMicroLearning(
            {
              name: 'invalid escape room',
              displayName: 'invalid escape room',
              stacks: [],
              courseId,
              multiplier: 1,
              startDate: new Date(),
              endDate: new Date(Date.now() + 60_000),
              isEscapeRoom: true,
              escapeRoomTimeLimit: invalid.timeLimit,
              escapeRoomHintPenalty: invalid.hintPenalty,
            },
            rejectingCtx()
          ),
      ],
      [
        'GroupActivity',
        () =>
          manipulateGroupActivity(
            {
              name: 'invalid escape room',
              displayName: 'invalid escape room',
              courseId,
              multiplier: 1,
              startDate: new Date(),
              endDate: new Date(Date.now() + 60_000),
              clues: [],
              stack: { order: 0, elements: [] },
              isEscapeRoom: true,
              escapeRoomTimeLimit: invalid.timeLimit,
              escapeRoomHintPenalty: invalid.hintPenalty,
            },
            rejectingCtx()
          ),
      ],
      [
        'LiveQuiz',
        () =>
          manipulateLiveQuiz(
            {
              name: 'invalid escape room',
              displayName: 'invalid escape room',
              blocks: [
                {
                  ...baseBlock,
                  escapeRoomTimeLimit: invalid.timeLimit,
                  escapeRoomHintPenalty: invalid.hintPenalty,
                },
              ],
              multiplier: 1,
              isGamificationEnabled: false,
              isPinProtected: false,
              isConfusionFeedbackEnabled: false,
              isLiveQAEnabled: false,
              isModerationEnabled: false,
            },
            rejectingCtx()
          ),
      ],
    ])(
      'rejects invalid numeric settings for %s before database access',
      async (_mode, action) => {
        await expect(action()).rejects.toMatchObject({
          extensions: { code: 'BAD_USER_INPUT' },
        })
      }
    )
  }

  it('returns BAD_USER_INPUT through the public GraphQL mutation resolver', async () => {
    const resolver = schema.getMutationType()!.getFields().createPracticeQuiz!
      .resolve!
    const context = {
      ...lecturerCtx,
      user: {
        ...lecturerCtx.user,
        catalystIndividual: true,
      },
    }

    await expect(
      resolver(
        {},
        {
          name: 'invalid-escape-room',
          displayName: 'Invalid escape room',
          stacks: [],
          courseId: 'not-read-before-validation',
          multiplier: 1,
          order: DB.ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          isEscapeRoom: true,
          escapeRoomTimeLimit: 0,
          escapeRoomHintPenalty: 0,
        },
        context,
        {} as any
      )
    ).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    })
  })
})
