import * as DB from '@klicker-uzh/prisma/client'
import { getEscapeRoomLifecycleClaimKey } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import {
  type ContextWithUser,
  courseId,
  createdQuizIds,
  createdUserIds,
  createUserCtx,
  getEscapeRoomHints,
  getMicroLearningData,
  getPracticeQuizData,
  lecturerCtx,
  manipulatePracticeQuiz,
  participantCtx,
  prisma,
  recomputeDerivedPermissions,
  requestEscapeRoomHint,
  respondToElementStack,
  scElement,
  scResponse,
  seedEscapeRoomMicroLearning,
  seedEscapeRoomPracticeQuiz,
  seedEscapeRoomQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
  TEST_PREFIX,
} from './escapeRoomTestHarness.js'

// ! Escape-room hint authoring round-trip
// #region
describe('escape-room hint authoring', () => {
  async function seedDraftQuizWithHint(hint: string) {
    const quiz = await seedEscapeRoomPracticeQuiz(
      {
        elements: [scElement],
        courseId,
        status: DB.PublicationStatus.DRAFT,
      },
      lecturerCtx
    )
    createdQuizIds.push(quiz.id)
    const instance = quiz.stacks[0]!.elements[0]!
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: { options: { ...instance.options, escapeRoomHint: hint } },
    })
    return { quiz, instance }
  }

  function editArgs(
    quiz: Awaited<ReturnType<typeof seedEscapeRoomPracticeQuiz>>,
    instance: DB.ElementInstance,
    escapeRoomHint?: string | null
  ) {
    return {
      id: quiz.id,
      name: quiz.name,
      displayName: quiz.displayName,
      description: quiz.description,
      stacks: [
        {
          order: 0,
          elements: [
            {
              elementId: instance.elementId,
              order: 0,
              existingInstanceId: instance.id,
              duplicateInstance: false,
              ...(typeof escapeRoomHint === 'undefined'
                ? {}
                : { escapeRoomHint }),
            },
          ],
        },
      ],
      courseId,
      multiplier: 1,
      order: DB.ElementOrderType.SEQUENTIAL,
      resetTimeDays: 1,
      isEscapeRoom: true,
    }
  }

  it('preserves an omitted hint, updates it, and explicitly clears it', async () => {
    const { quiz, instance } = await seedDraftQuizWithHint('original hint')

    await manipulatePracticeQuiz(editArgs(quiz, instance), lecturerCtx)
    expect(
      (
        await prisma.elementInstance.findUniqueOrThrow({
          where: { id: instance.id },
        })
      ).options.escapeRoomHint
    ).toBe('original hint')

    await manipulatePracticeQuiz(
      editArgs(quiz, instance, '  updated hint  '),
      lecturerCtx
    )
    expect(
      (
        await prisma.elementInstance.findUniqueOrThrow({
          where: { id: instance.id },
        })
      ).options.escapeRoomHint
    ).toBe('updated hint')

    await manipulatePracticeQuiz(editArgs(quiz, instance, ''), lecturerCtx)
    expect(
      (
        await prisma.elementInstance.findUniqueOrThrow({
          where: { id: instance.id },
        })
      ).options.escapeRoomHint
    ).toBeNull()
  })

  it('copies the existing hint when duplicating an instance with no override', async () => {
    const { quiz, instance } = await seedDraftQuizWithHint('copy me')
    await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)
    const result = await manipulatePracticeQuiz(
      {
        name: `${TEST_PREFIX}-hint-copy`,
        displayName: 'Hint copy',
        stacks: [
          {
            order: 0,
            elements: [
              {
                elementId: instance.elementId,
                order: 0,
                existingInstanceId: instance.id,
                duplicateInstance: true,
              },
            ],
          },
        ],
        courseId,
        multiplier: 1,
        order: DB.ElementOrderType.SEQUENTIAL,
        resetTimeDays: 1,
        isEscapeRoom: true,
      },
      lecturerCtx
    )
    createdQuizIds.push(result.id)
    const duplicate = await prisma.elementInstance.findFirstOrThrow({
      where: { elementStack: { practiceQuizId: result.id } },
    })
    expect(duplicate.options.escapeRoomHint).toBe('copy me')
  })

  it('keeps a duplicate hint override isolated from the retained instance', async () => {
    const { quiz, instance } = await seedDraftQuizWithHint('original')
    await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)
    const args = editArgs(quiz, instance)
    args.stacks[0]!.elements.push({
      elementId: instance.elementId,
      order: 1,
      existingInstanceId: instance.id,
      duplicateInstance: true,
      escapeRoomHint: 'duplicate only',
    })

    await manipulatePracticeQuiz(args, lecturerCtx)

    const instances = await prisma.elementInstance.findMany({
      where: { elementStack: { practiceQuizId: quiz.id } },
      orderBy: { order: 'asc' },
    })
    expect(instances).toHaveLength(2)
    expect(instances[0]!.options.escapeRoomHint).toBe('original')
    expect(instances[1]!.options.escapeRoomHint).toBe('duplicate only')
  })

  it('returns raw hints to WRITE collaborators but not READ-only users', async () => {
    const { quiz, instance } = await seedDraftQuizWithHint('owner only')
    const otherLecturer = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}-hint-reader@example.com`,
        shortname: `${TEST_PREFIX}-hint-reader`,
        role: DB.UserRole.USER,
      },
    })
    createdUserIds.push(otherLecturer.id)
    const permission = await prisma.permission.create({
      data: {
        userId: otherLecturer.id,
        practiceQuizId: quiz.id,
        permissionLevel: DB.PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)
    await expect(
      getEscapeRoomHints(
        { practiceQuizId: quiz.id },
        createUserCtx(otherLecturer.id)
      )
    ).rejects.toThrow('Write access is required')

    await prisma.permission.update({
      where: { id: permission.id },
      data: { permissionLevel: DB.PermissionLevel.WRITE },
    })
    await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)
    await expect(
      getEscapeRoomHints(
        { practiceQuizId: quiz.id },
        createUserCtx(otherLecturer.id)
      )
    ).resolves.toEqual([{ instanceId: instance.id, hint: 'owner only' }])
    await expect(
      getEscapeRoomHints({ practiceQuizId: quiz.id }, lecturerCtx)
    ).resolves.toEqual([{ instanceId: instance.id, hint: 'owner only' }])
  })
})
// #endregion

// ! requestEscapeRoomHint - time-penalty hints
// #region
describe('requestEscapeRoomHint - time-penalty hints', () => {
  // The seed helper does not author per-instance hints, so patch the
  // instance options directly to simulate a lecturer-authored hint.
  async function seedQuizWithHint(hint: string) {
    const quiz = await seedEscapeRoomQuiz(2)
    const instance = quiz.stacks[0]!.elements[0]!
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: { options: { ...instance.options, escapeRoomHint: hint } },
    })
    return { quiz, instanceId: instance.id }
  }

  it('reveals the hint and charges the penalty once, idempotently', async () => {
    const { quiz, instanceId } = await seedQuizWithHint('look under the mat')
    const participant = await seedParticipant('hint-reveal')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    expect(attempt.penaltySeconds).toBe(0)

    // first request: reveals hint, applies the 30s default penalty
    const first = await requestEscapeRoomHint(
      { practiceQuizId: quiz.id, instanceId },
      participantCtx(participant.id)
    )
    expect(first.hint).toBe('look under the mat')
    expect(first.attempt.penaltySeconds).toBe(30)
    expect(first.attempt.hintsUsed).toEqual([String(instanceId)])

    // second request for the same instance: same hint, no extra penalty
    const second = await requestEscapeRoomHint(
      { practiceQuizId: quiz.id, instanceId },
      participantCtx(participant.id)
    )
    expect(second.hint).toBe('look under the mat')
    expect(second.attempt.penaltySeconds).toBe(30)

    const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(persisted.penaltySeconds).toBe(30)
  })

  it('charges a concurrently requested hint only once', async () => {
    const { quiz, instanceId } = await seedQuizWithHint('concurrent hint')
    const participant = await seedParticipant('hint-concurrent')
    const claims = new Map<string, string>()
    const context = participantCtx(participant.id, claims)
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      context
    )

    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        requestEscapeRoomHint({ practiceQuizId: quiz.id, instanceId }, context)
      )
    )
    expect(results.map((result) => result.hint)).toEqual([
      'concurrent hint',
      'concurrent hint',
    ])
    const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(persisted.penaltySeconds).toBe(30)
    expect(persisted.hintsUsed).toEqual([String(instanceId)])
  })

  it('refuses to reveal or charge a hint while another lifecycle action owns the attempt', async () => {
    const { quiz, instanceId } = await seedQuizWithHint('locked hint')
    const participant = await seedParticipant('hint-processing')
    const claims = new Map<string, string>()
    const context = participantCtx(participant.id, claims)
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      context
    )
    const claimKey = getEscapeRoomLifecycleClaimKey(
      'practiceQuiz',
      quiz.id,
      participant.id
    )
    await context.redisExec.set(claimKey, 'in-flight-response', 'EX', 300, 'NX')

    await expect(
      requestEscapeRoomHint({ practiceQuizId: quiz.id, instanceId }, context)
    ).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' },
    })

    const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(persisted.penaltySeconds).toBe(0)
    expect(persisted.hintsUsed).toEqual([])

    await context.redisExec.eval('', 1, claimKey, 'in-flight-response')
  })

  it('rejects a hint request for an element that has no hint', async () => {
    const quiz = await seedEscapeRoomQuiz(2)
    const instanceId = quiz.stacks[0]!.elements[0]!.id
    const participant = await seedParticipant('hint-none')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('No hint available for this element')
  })

  it('rejects a hint request without a running attempt', async () => {
    const { quiz, instanceId } = await seedQuizWithHint('secret')
    const participant = await seedParticipant('hint-no-attempt')

    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('No active escape room attempt found for this activity')
  })

  it('rejects a hint request for an instance that belongs to another activity', async () => {
    const { instanceId: foreignInstanceId } =
      await seedQuizWithHint('foreign hint')
    const { quiz } = await seedQuizWithHint('own hint')
    const participant = await seedParticipant('hint-cross-activity')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    // pairing a valid attempt with an instanceId from a different quiz must
    // not leak that quiz's hint text
    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId: foreignInstanceId },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Element does not belong to this activity')
  })

  it('rejects a hint request from a non-participant', async () => {
    const { quiz, instanceId } = await seedQuizWithHint('secret')

    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        lecturerCtx as unknown as ContextWithUser
      )
    ).rejects.toThrow('Only participants can request escape room hints')
  })

  it('rejects a request that supplies more than one activity ID', async () => {
    // guards against the priority-mismatch leak: a valid attempt on one
    // activity must not gate a hint read against a second activity's instance
    const { quiz, instanceId } = await seedQuizWithHint('own hint')
    const participant = await seedParticipant('hint-multi-id')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, microLearningId: quiz.id, instanceId },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Exactly one activity ID must be specified')
  })

  it('rejects a hint for a future locked stack without charging it', async () => {
    const quiz = await seedEscapeRoomQuiz(2)
    const i0 = quiz.stacks[0]!.elements[0]!
    const i1 = quiz.stacks[1]!.elements[0]!
    await prisma.elementInstance.update({
      where: { id: i0.id },
      data: { options: { ...i0.options, escapeRoomHint: 'hint zero' } },
    })
    await prisma.elementInstance.update({
      where: { id: i1.id },
      data: { options: { ...i1.options, escapeRoomHint: 'hint one' } },
    })
    const participant = await seedParticipant('hint-accumulate')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    await requestEscapeRoomHint(
      { practiceQuizId: quiz.id, instanceId: i0.id },
      participantCtx(participant.id)
    )
    await expect(
      requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId: i1.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'You must answer all preceding questions correctly before requesting this hint'
    )

    const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(persisted.penaltySeconds).toBe(30)
    expect(persisted.hintsUsed).toEqual([String(i0.id)])

    await respondToElementStack(
      {
        stackId: quiz.stacks[0]!.id,
        courseId,
        responses: [scResponse(i0.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    const second = await requestEscapeRoomHint(
      { practiceQuizId: quiz.id, instanceId: i1.id },
      participantCtx(participant.id)
    )
    expect(second.attempt.penaltySeconds).toBe(60)
    expect((second.attempt.hintsUsed as string[]).sort()).toEqual(
      [String(i0.id), String(i1.id)].sort()
    )
  })

  it('restores only an already-used hint for the owning participant', async () => {
    const { quiz, instanceId } = await seedQuizWithHint('persistent hint')
    const participant = await seedParticipant('hint-reload')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    await requestEscapeRoomHint(
      { practiceQuizId: quiz.id, instanceId },
      participantCtx(participant.id)
    )

    const reloaded = await getPracticeQuizData(
      { id: quiz.id },
      participantCtx(participant.id)
    )
    const reloadedElement = reloaded!.stacks[0]!.elements[0]!
    expect(
      'revealedHint' in reloadedElement
        ? reloadedElement.revealedHint
        : undefined
    ).toBe('persistent hint')

    const otherParticipant = await seedParticipant('hint-reload-other')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(otherParticipant.id)
    )
    const otherView = await getPracticeQuizData(
      { id: quiz.id },
      participantCtx(otherParticipant.id)
    )
    const otherElement = otherView!.stacks[0]!.elements[0]!
    expect(
      'revealedHint' in otherElement ? otherElement.revealedHint : undefined
    ).toBeNull()
  })

  it('gates and restores hints for MicroLearning without cross-participant leakage', async () => {
    const microLearning = await seedEscapeRoomMicroLearning(
      { elements: [scElement, scElement], courseId },
      lecturerCtx
    )
    const first = microLearning.stacks[0]!.elements[0]!
    const second = microLearning.stacks[1]!.elements[0]!
    await prisma.elementInstance.update({
      where: { id: first.id },
      data: { options: { ...first.options, escapeRoomHint: 'micro first' } },
    })
    await prisma.elementInstance.update({
      where: { id: second.id },
      data: {
        options: { ...second.options, escapeRoomHint: 'micro second' },
      },
    })
    const participant = await seedParticipant('micro-hint-owner')
    await startEscapeRoomAttempt(
      { microLearningId: microLearning.id },
      participantCtx(participant.id)
    )

    await expect(
      requestEscapeRoomHint(
        { microLearningId: microLearning.id, instanceId: second.id },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'You must answer all preceding questions correctly before requesting this hint'
    )
    await requestEscapeRoomHint(
      { microLearningId: microLearning.id, instanceId: first.id },
      participantCtx(participant.id)
    )
    const ownerView = await getMicroLearningData(
      { id: microLearning.id },
      participantCtx(participant.id)
    )
    const ownerElement = ownerView!.stacks[0]!.elements[0]!
    expect(
      'revealedHint' in ownerElement ? ownerElement.revealedHint : undefined
    ).toBe('micro first')

    const otherParticipant = await seedParticipant('micro-hint-other')
    await startEscapeRoomAttempt(
      { microLearningId: microLearning.id },
      participantCtx(otherParticipant.id)
    )
    const otherView = await getMicroLearningData(
      { id: microLearning.id },
      participantCtx(otherParticipant.id)
    )
    const otherElement = otherView!.stacks[0]!.elements[0]!
    expect(
      'revealedHint' in otherElement ? otherElement.revealedHint : undefined
    ).toBeNull()
  })

  it('refuses to start while the target lifecycle is being updated', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const participant = await seedParticipant('start-processing')
    const context = participantCtx(participant.id)
    const claimKey = getEscapeRoomLifecycleClaimKey(
      'practiceQuiz',
      quiz.id,
      participant.id
    )
    await context.redisExec.set(
      claimKey,
      'in-flight-lifecycle',
      'EX',
      300,
      'NX'
    )

    await expect(
      startEscapeRoomAttempt({ practiceQuizId: quiz.id }, context)
    ).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' },
    })
    expect(
      await prisma.escapeRoomAttempt.findUnique({
        where: {
          participantId_practiceQuizId: {
            participantId: participant.id,
            practiceQuizId: quiz.id,
          },
        },
      })
    ).toBeNull()

    await context.redisExec.eval('', 1, claimKey, 'in-flight-lifecycle')
  })
})
// #endregion
