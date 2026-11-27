import * as DB from '@klicker-uzh/prisma/client'
import type { GraphQLObjectType } from 'graphql'
import { describe, expect, it, vi } from 'vitest'
import {
  courseId,
  createdQuizIds,
  getEscapeRoomHints,
  getEscapeRoomProgress,
  lecturerCtx,
  manipulateLiveQuiz,
  manipulatePracticeQuiz,
  prisma,
  recomputeDerivedPermissions,
  scElement,
  schema,
  seedEscapeRoomGroupActivity,
  seedEscapeRoomMicroLearning,
  seedEscapeRoomQuiz,
  seedLiveQuiz,
  seedParticipant,
  TEST_PREFIX,
} from './escapeRoomTestHarness.js'

const STAGES = 4

// One logical run: stage 0 solved after one wrong attempt, stage 1 revealed,
// stage 2 skipped after one hint, stage 3 untouched.
function outcomeRecords(stageKeys: string[]) {
  const at = new Date().toISOString()
  return [
    { stageKey: stageKeys[0], wrongAttempts: 1, outcome: 'SOLVED', at },
    { stageKey: stageKeys[1], wrongAttempts: 0, outcome: 'REVEALED', at },
    { stageKey: stageKeys[2], wrongAttempts: 0, outcome: 'SKIPPED', at },
  ]
}

function numbersOnly(
  stages: Awaited<ReturnType<typeof getEscapeRoomProgress>> extends infer P
    ? P extends { stages: infer S }
      ? S
      : never
    : never
) {
  return stages.map(({ stageKey: _key, title: _title, ...rest }) => rest)
}

describe('per-stage escape room insights', () => {
  it('counts the same outcome sequence identically in every mode', async () => {
    const participant = await seedParticipant('insights-modes')

    // Practice Quiz: stages are stacks, hints key by instance id
    const quiz = await seedEscapeRoomQuiz(STAGES)
    await prisma.escapeRoomAttempt.create({
      data: {
        practiceQuizId: quiz.id,
        participantId: participant.id,
        timeLimit: 3600,
        stageOutcomes: outcomeRecords(quiz.stacks.map((s) => String(s.id))),
        hintsUsed: [String(quiz.stacks[2]!.elements[0]!.id)],
      },
    })
    const practice = await getEscapeRoomProgress(
      { practiceQuizId: quiz.id },
      lecturerCtx
    )

    // Microlearning
    const micro = await seedEscapeRoomMicroLearning(
      {
        elements: Array.from({ length: STAGES }, () => scElement),
        courseId,
      },
      lecturerCtx
    )
    await prisma.escapeRoomAttempt.create({
      data: {
        microLearningId: micro.id,
        participantId: participant.id,
        timeLimit: 3600,
        stageOutcomes: outcomeRecords(micro.stacks.map((s) => String(s.id))),
        hintsUsed: [String(micro.stacks[2]!.elements[0]!.id)],
      },
    })
    const microProgress = await getEscapeRoomProgress(
      { microLearningId: micro.id },
      lecturerCtx
    )

    // Group Activity: stages are element instances; reveal and skip live in
    // stageResponses
    const { groupActivity, attempt } = await seedEscapeRoomGroupActivity(
      {
        elements: Array.from({ length: STAGES }, () => scElement),
        courseId,
        participantIds: [participant.id],
      },
      lecturerCtx
    )
    const groupInstances = groupActivity.stacks[0]!.elements
    const groupKeys = groupInstances.map((i) => String(i.id))
    const groupRecords = outcomeRecords(groupKeys)
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: {
        stageOutcomes: [groupRecords[0]!],
        stageResponses: groupRecords.map((record) => ({
          instanceId: Number(record.stageKey),
          response: null,
          clearedAt: record.at,
          outcome: record.outcome,
        })),
        hintsUsed: [String(groupInstances[2]!.id)],
      },
    })
    const group = await getEscapeRoomProgress(
      { groupActivityId: groupActivity.id },
      lecturerCtx
    )

    // Live Quiz block: stages are element instances
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: scElement.id, type: scElement.type }],
        status: DB.PublicationStatus.PUBLISHED,
        courseId,
      },
      lecturerCtx
    )
    const seededBlock = liveQuiz.blocks[0]!
    for (let order = 1; order < STAGES; order++) {
      await prisma.elementInstance.create({
        data: {
          order,
          elementId: scElement.id,
          elementBlockId: seededBlock.id,
          type: DB.ElementInstanceType.LIVE_QUIZ,
          elementType: scElement.type,
          options: {},
          elementData: {} as any,
          results: {} as any,
          anonymousResults: {} as any,
          ownerId: lecturerCtx.user.sub,
        },
      })
    }
    const block = await prisma.elementBlock.findUniqueOrThrow({
      where: { id: seededBlock.id },
      include: { elements: { orderBy: { order: 'asc' } } },
    })
    await prisma.escapeRoomConfig.create({
      data: { elementBlockId: block.id, timeLimit: 300 },
    })
    await prisma.escapeRoomAttempt.create({
      data: {
        elementBlockId: block.id,
        participantId: participant.id,
        timeLimit: 300,
        stageOutcomes: outcomeRecords(block.elements.map((e) => String(e.id))),
        hintsUsed: [String(block.elements[2]!.id)],
      },
    })
    const redisExec = {
      pipeline: () => ({
        smembers: vi.fn(),
        exec: vi.fn().mockResolvedValue([[null, []]]),
      }),
    }
    const live = await getEscapeRoomProgress(
      { elementBlockId: block.id, liveQuizId: liveQuiz.id },
      { ...lecturerCtx, redisExec } as any
    )

    const expected = [
      { solved: 1, wrongAttempts: 1, hintsUsed: 0 },
      { revealed: 1 },
      { skipped: 1, hintsUsed: 1 },
      { notReached: 1 },
    ]
    for (const progress of [practice, microProgress, group, live]) {
      expect(progress!.stages).toHaveLength(STAGES)
      progress!.stages.forEach((stage, index) => {
        expect(stage).toMatchObject(expected[index]!)
      })
    }
    const reference = numbersOnly(practice!.stages)
    for (const progress of [microProgress, group, live]) {
      expect(numbersOnly(progress!.stages)).toEqual(reference)
    }
  })

  it('counts wrong attempts without an outcome as attempted, not cleared', async () => {
    const participant = await seedParticipant('insights-wrong')
    const quiz = await seedEscapeRoomQuiz(2)
    await prisma.escapeRoomAttempt.create({
      data: {
        practiceQuizId: quiz.id,
        participantId: participant.id,
        timeLimit: 3600,
        stageOutcomes: [
          {
            stageKey: String(quiz.stacks[0]!.id),
            wrongAttempts: 2,
            outcome: null,
            at: null,
          },
        ],
      },
    })
    const progress = await getEscapeRoomProgress(
      { practiceQuizId: quiz.id },
      lecturerCtx
    )
    expect(progress!.stages[0]).toMatchObject({
      attemptedNotCleared: 1,
      notReached: 0,
      wrongAttempts: 2,
    })
    expect(progress!.stages[1]).toMatchObject({
      attemptedNotCleared: 0,
      notReached: 1,
    })
  })
})

describe('escape room debrief text', () => {
  const liveCommon = {
    name: `${TEST_PREFIX}-live-debrief`,
    displayName: 'Escape debrief',
    multiplier: 1,
    isGamificationEnabled: false,
    isPinProtected: false,
    isConfusionFeedbackEnabled: false,
    isLiveQAEnabled: false,
    isModerationEnabled: false,
    courseId: null,
  }

  function liveBlocks(
    existingInstanceId: number | null,
    debrief?: string | null
  ) {
    return [
      {
        order: 0,
        isEscapeRoom: true,
        escapeRoomTimeLimit: 420,
        elements: [
          {
            elementId: scElement.id,
            order: 0,
            existingInstanceId,
            duplicateInstance: false,
            ...(typeof debrief === 'undefined'
              ? {}
              : { escapeRoomDebrief: debrief }),
          },
        ],
      },
    ]
  }

  it('round-trips through Live Quiz create and edit', async () => {
    await recomputeDerivedPermissions(
      { elementId: scElement.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const created = await manipulateLiveQuiz(
      { ...liveCommon, blocks: liveBlocks(null, '  first debrief  ') },
      lecturerCtx
    )
    createdQuizIds.push(created.id)
    const block = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: created.id },
      include: { elements: true },
    })
    const instanceId = block.elements[0]!.id
    const read = async () => {
      const [hints, progress] = await Promise.all([
        getEscapeRoomHints({ liveQuizId: created.id }, lecturerCtx),
        getEscapeRoomProgress(
          { elementBlockId: block.id, liveQuizId: created.id },
          lecturerCtx
        ),
      ])
      return { hints, progress }
    }

    let { hints, progress } = await read()
    expect(hints).toMatchObject([{ instanceId, debrief: 'first debrief' }])
    expect(progress!.stages[0]!.debrief).toBe('first debrief')

    const edit = (debrief?: string | null) =>
      manipulateLiveQuiz(
        {
          ...liveCommon,
          id: created.id,
          blocks: liveBlocks(instanceId, debrief),
        },
        lecturerCtx
      )
    await edit('second debrief')
    ;({ hints, progress } = await read())
    expect(hints[0]!.debrief).toBe('second debrief')

    // The edit loop re-creates blocks, so look the instance up again.
    const editedBlock = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: created.id },
      include: { elements: true },
    })
    expect(editedBlock.elements[0]!.options).toMatchObject({
      escapeRoomDebrief: 'second debrief',
    })

    await manipulateLiveQuiz(
      {
        ...liveCommon,
        id: created.id,
        blocks: liveBlocks(editedBlock.elements[0]!.id),
      },
      lecturerCtx
    )
    expect(
      (
        await prisma.elementInstance.findUniqueOrThrow({
          where: { id: editedBlock.elements[0]!.id },
        })
      ).options
    ).toMatchObject({ escapeRoomDebrief: 'second debrief' })

    await manipulateLiveQuiz(
      {
        ...liveCommon,
        id: created.id,
        blocks: liveBlocks(editedBlock.elements[0]!.id, ''),
      },
      lecturerCtx
    )
    expect(
      await getEscapeRoomHints({ liveQuizId: created.id }, lecturerCtx)
    ).toEqual([])
  })

  it('round-trips through Practice Quiz create, edit and duplicate and joins a stack in element order', async () => {
    const stackElement = (
      order: number,
      extra: Record<string, unknown> = {}
    ) => ({
      elementId: scElement.id,
      order,
      existingInstanceId: null,
      duplicateInstance: false,
      ...extra,
    })
    const practiceArgs = (name: string, elements: unknown[]) => ({
      name,
      displayName: name,
      stacks: [{ order: 0, elements }],
      courseId,
      multiplier: 1,
      order: DB.ElementOrderType.SEQUENTIAL,
      resetTimeDays: 1,
      isEscapeRoom: true,
    })
    await recomputeDerivedPermissions(
      { elementId: scElement.id, userId: lecturerCtx.user.sub },
      prisma
    )
    const created = await manipulatePracticeQuiz(
      practiceArgs(`${TEST_PREFIX}-debrief-pq`, [
        stackElement(0, { escapeRoomDebrief: 'alpha' }),
        stackElement(1, { escapeRoomDebrief: 'beta' }),
      ]) as any,
      lecturerCtx
    )
    createdQuizIds.push(created.id)
    await recomputeDerivedPermissions({ practiceQuizId: created.id }, prisma)

    const progress = await getEscapeRoomProgress(
      { practiceQuizId: created.id },
      lecturerCtx
    )
    expect(progress!.stages[0]!.debrief!.split('\n\n')).toEqual([
      'alpha',
      'beta',
    ])

    const instances = await prisma.elementInstance.findMany({
      where: { elementStack: { practiceQuizId: created.id } },
      orderBy: { order: 'asc' },
    })
    // Edit: change the first debrief, leave the second one omitted
    await manipulatePracticeQuiz(
      {
        ...practiceArgs(
          `${TEST_PREFIX}-debrief-pq`,
          instances.map((i, ix) => ({
            elementId: i.elementId,
            order: ix,
            existingInstanceId: i.id,
            duplicateInstance: false,
            ...(ix === 0 ? { escapeRoomDebrief: 'gamma' } : {}),
          }))
        ),
        id: created.id,
      } as any,
      lecturerCtx
    )
    const hints = await getEscapeRoomHints(
      { practiceQuizId: created.id },
      lecturerCtx
    )
    expect(hints.map((h) => h.debrief)).toEqual(['gamma', 'beta'])

    // Duplicate without an override copies the stored text
    const copy = await manipulatePracticeQuiz(
      practiceArgs(
        `${TEST_PREFIX}-debrief-copy`,
        instances.slice(0, 1).map((i) => ({
          elementId: i.elementId,
          order: 0,
          existingInstanceId: i.id,
          duplicateInstance: true,
        }))
      ) as any,
      lecturerCtx
    )
    createdQuizIds.push(copy.id)
    const copied = await prisma.elementInstance.findFirstOrThrow({
      where: { elementStack: { practiceQuizId: copy.id } },
    })
    expect(copied.options).toMatchObject({ escapeRoomDebrief: 'gamma' })
  })

  it('is not part of any participant-facing GraphQL type', () => {
    // Only the lecturer-side payloads and the authoring input may carry it.
    const carriers: string[] = []
    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__') || !('getFields' in type)) continue
      for (const field of Object.keys(
        (type as GraphQLObjectType).getFields()
      )) {
        if (field === 'escapeRoomDebrief' || field === 'debrief') {
          carriers.push(`${type.name}.${field}`)
        }
      }
    }
    expect(carriers.sort()).toEqual([
      'ElementInstanceInput.escapeRoomDebrief',
      'EscapeRoomHint.debrief',
      'EscapeRoomStageProgress.debrief',
    ])
  })
})
