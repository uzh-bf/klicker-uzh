import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  QR_SCAN_CODE,
  TEST_PREFIX,
  courseId,
  createdElementIds,
  createdParticipantIds,
  getGroupActivityDetails,
  groupScResponse,
  lecturerCtx,
  manipulateGroupActivity,
  participantCtx,
  prisma,
  qrElement,
  qrResponse,
  recomputeDerivedPermissions,
  scElement,
  seedEscapeRoomGroupActivity,
  seedParticipant,
  submitGroupActivityDecisions,
} from './escapeRoomTestHarness.js'

describe('submitGroupActivityDecisions - ordered escape stages', () => {
  async function seedGroupEscapeRoom() {
    const participantA = await seedParticipant(
      `group-a-${createdParticipantIds.length}`
    )
    const participantB = await seedParticipant(
      `group-b-${createdParticipantIds.length}`
    )
    return seedEscapeRoomGroupActivity(
      {
        elements: [scElement, scElement],
        courseId,
        participantIds: [participantA.id, participantB.id],
      },
      lecturerCtx
    ).then((fixture) => ({ ...fixture, participantA, participantB }))
  }

  async function snapshotGroupEscapeRoom(
    fixture: Awaited<ReturnType<typeof seedGroupEscapeRoom>>
  ) {
    const instances = fixture.groupActivity.stacks[0]!.elements
    return {
      results: await prisma.elementInstance.findMany({
        where: { id: { in: instances.map((instance) => instance.id) } },
        orderBy: { id: 'asc' },
        select: { id: true, results: true },
      }),
      activityInstance: await prisma.groupActivityInstance.findUniqueOrThrow({
        where: { id: fixture.activityInstance.id },
        select: { decisions: true, decisionsSubmittedAt: true },
      }),
      attempt: await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: fixture.attempt.id },
        select: {
          status: true,
          completedAt: true,
          lockoutUntil: true,
          stageResponses: true,
        },
      }),
    }
  }

  it('rejects unusable escape-room compositions before creating an activity', async () => {
    const elements = await Promise.all([
      prisma.element.create({
        data: {
          type: DB.ElementType.CONTENT,
          name: `${TEST_PREFIX}-group-content-only`,
          content: 'Read-only content',
          options: {},
          ownerId: lecturerCtx.user.sub,
        },
      }),
      prisma.element.create({
        data: {
          type: DB.ElementType.SC,
          name: `${TEST_PREFIX}-group-no-sample`,
          content: 'Question without a sample solution',
          options: {
            hasSampleSolution: false,
            hasAnswerFeedbacks: false,
            displayMode: 'LIST',
            choices: [
              { ix: 0, value: 'A', correct: false, feedback: '' },
              { ix: 1, value: 'B', correct: false, feedback: '' },
            ],
          },
          ownerId: lecturerCtx.user.sub,
        },
      }),
    ])
    createdElementIds.push(...elements.map((element) => element.id))
    for (const element of elements) {
      await recomputeDerivedPermissions(
        { elementId: element.id, userId: lecturerCtx.user.sub },
        prisma
      )
    }

    const baseArgs = {
      displayName: 'Invalid group escape room',
      description: 'Must not be persisted',
      courseId,
      multiplier: 1,
      startDate: new Date(Date.now() + 60_000),
      endDate: new Date(Date.now() + 3_600_000),
      clues: [],
      isEscapeRoom: true,
    }
    const scenarios = [
      {
        name: `${TEST_PREFIX}-group-content-only-activity`,
        element: elements[0]!,
        message:
          'Escape room group activities require at least one answerable question',
      },
      {
        name: `${TEST_PREFIX}-group-no-sample-activity`,
        element: elements[1]!,
        message:
          'Escape room group activity questions require sample solutions',
      },
    ]

    for (const scenario of scenarios) {
      await expect(
        manipulateGroupActivity(
          {
            ...baseArgs,
            name: scenario.name,
            stack: {
              order: 0,
              elements: [
                {
                  elementId: scenario.element.id,
                  order: 0,
                  existingInstanceId: null,
                  duplicateInstance: false,
                },
              ],
            },
          },
          lecturerCtx
        )
      ).rejects.toMatchObject({
        message: scenario.message,
        extensions: { code: 'BAD_USER_INPUT' },
      })
      await expect(
        prisma.groupActivity.findFirst({ where: { name: scenario.name } })
      ).resolves.toBeNull()
    }
  })

  it.each([
    [
      'empty',
      'Group activity responses must exactly match the required instances',
    ],
    [
      'foreign',
      'Group activity responses must exactly match the required instances',
    ],
    ['duplicate', 'Only the current escape room stage can be answered'],
    ['multi-stage', 'Only the current escape room stage can be answered'],
  ] as const)('rejects a %s response set without changing any escape-room state', async (kind, message) => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const foreignFixture =
      kind === 'foreign' ? await seedGroupEscapeRoom() : null
    const responses =
      kind === 'empty'
        ? []
        : kind === 'foreign'
          ? [
              groupScResponse(
                foreignFixture!.groupActivity.stacks[0]!.elements[0]!.id,
                0
              ),
            ]
          : kind === 'duplicate'
            ? [
                groupScResponse(instances[0]!.id, 0),
                groupScResponse(instances[0]!.id, 0),
              ]
            : [
                groupScResponse(instances[0]!.id, 0),
                groupScResponse(instances[1]!.id, 0),
              ]
    const before = await snapshotGroupEscapeRoom(fixture)

    await expect(
      submitGroupActivityDecisions(
        { activityId: fixture.activityInstance.id, responses },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toThrow(message)

    expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
  })

  it('rejects malformed response payloads before changing any state', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const malformed = [groupScResponse(instances[0]!.id, 0)]
    const malformedChoice = malformed[0]!.choicesResponse[0] as { ix: number }
    malformedChoice.ix = 999
    const before = await snapshotGroupEscapeRoom(fixture)

    await expect(
      submitGroupActivityDecisions(
        { activityId: fixture.activityInstance.id, responses: malformed },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toThrow(
      'Group activity responses must exactly match the required instances'
    )

    expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
  })

  it('fails closed when a required instance has no sample solution', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const elementData = instances[1]!.elementData as any
    elementData.options.hasSampleSolution = false
    await prisma.elementInstance.update({
      where: { id: instances[1]!.id },
      data: { elementData },
    })
    const before = await snapshotGroupEscapeRoom(fixture)

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(instances[0]!.id, 0)],
        },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toThrow(
      'Escape room group activity instances require sample solutions'
    )

    expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
  })

  it('leaves all state unchanged when grading the current stage fails', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    await prisma.elementInstance.update({
      where: { id: instances[0]!.id },
      data: { results: {} as any },
    })
    const before = await snapshotGroupEscapeRoom(fixture)

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(instances[0]!.id, 0)],
        },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toThrow('Group activity response type is not supported')

    expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
  })

  it('commits only expiry when the attempt time has elapsed', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    await prisma.escapeRoomAttempt.update({
      where: { id: fixture.attempt.id },
      data: { startedAt: new Date(Date.now() - 10_000), timeLimit: 1 },
    })
    const before = await snapshotGroupEscapeRoom(fixture)

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(instances[0]!.id, 0)],
        },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toThrow('Escape room time has expired')

    const after = await snapshotGroupEscapeRoom(fixture)
    expect(after.results).toEqual(before.results)
    expect(after.activityInstance).toEqual(before.activityInstance)
    expect(after.attempt).toEqual({
      ...before.attempt,
      status: DB.EscapeRoomStatus.EXPIRED,
    })
  })

  it('does not require content or flashcard instances in the answer set', async () => {
    const nonResponseElements = await Promise.all(
      [DB.ElementType.CONTENT, DB.ElementType.FLASHCARD].map((type) =>
        prisma.element.create({
          data: {
            type,
            name: `${TEST_PREFIX}-${type}-${createdElementIds.length}`,
            content: `${type} content`,
            options: {},
            ownerId: lecturerCtx.user.sub,
          },
        })
      )
    )
    createdElementIds.push(...nonResponseElements.map((element) => element.id))
    const participantA = await seedParticipant('mixed-group-a')
    const participantB = await seedParticipant('mixed-group-b')
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: [nonResponseElements[0]!, scElement, nonResponseElements[1]!],
        courseId,
        participantIds: [participantA.id, participantB.id],
      },
      lecturerCtx
    )
    const scInstance = fixture.groupActivity.stacks[0]!.elements.find(
      (instance) => instance.elementType === DB.ElementType.SC
    )!

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(scInstance.id, 0)],
        },
        participantCtx(participantA.id)
      )
    ).resolves.toBe(fixture.activityInstance.id)
  })

  it('rejects an activity with no answerable instances', async () => {
    const nonResponseElements = await Promise.all(
      [DB.ElementType.CONTENT, DB.ElementType.FLASHCARD].map((type) =>
        prisma.element.create({
          data: {
            type,
            name: `${TEST_PREFIX}-empty-${type}-${createdElementIds.length}`,
            content: `${type} content`,
            options: {},
            ownerId: lecturerCtx.user.sub,
          },
        })
      )
    )
    createdElementIds.push(...nonResponseElements.map((element) => element.id))
    const participantA = await seedParticipant('empty-group-a')
    const participantB = await seedParticipant('empty-group-b')
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: nonResponseElements,
        courseId,
        participantIds: [participantA.id, participantB.id],
      },
      lecturerCtx
    )
    const before = await snapshotGroupEscapeRoom({
      ...fixture,
      participantA,
      participantB,
    })

    await expect(
      submitGroupActivityDecisions(
        { activityId: fixture.activityInstance.id, responses: [] },
        participantCtx(participantA.id)
      )
    ).rejects.toThrow(
      'Group activity responses must exactly match the required instances'
    )

    expect(
      await snapshotGroupEscapeRoom({
        ...fixture,
        participantA,
        participantB,
      })
    ).toEqual(before)
  })

  it.each([
    { label: 'SC', type: DB.ElementType.SC, correctIds: [0] },
    { label: 'MC', type: DB.ElementType.MC, correctIds: [0, 2] },
    { label: 'KPRIM mixed', type: DB.ElementType.KPRIM, correctIds: [0, 2] },
    { label: 'KPRIM all false', type: DB.ElementType.KPRIM, correctIds: [] },
  ])('accepts production-shaped selected-only $label responses', async ({
    label,
    type,
    correctIds,
  }) => {
    const choices = Array.from(
      { length: type === DB.ElementType.SC ? 2 : 4 },
      (_, ix) => ({
        ix,
        value: `Choice ${ix}`,
        correct: correctIds.includes(ix),
        feedback: '',
      })
    )
    const element = await prisma.element.create({
      data: {
        type,
        name: `${TEST_PREFIX}-${type}-${createdElementIds.length}`,
        content: `${type} content`,
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
          displayMode: 'LIST',
          choices,
        },
        ownerId: lecturerCtx.user.sub,
      },
    })
    createdElementIds.push(element.id)
    const participantA = await seedParticipant(`${label}-group-a`)
    const participantB = await seedParticipant(`${label}-group-b`)
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: [element],
        courseId,
        participantIds: [participantA.id, participantB.id],
      },
      lecturerCtx
    )
    const instance = fixture.groupActivity.stacks[0]!.elements[0]!

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [
            {
              instanceId: instance.id,
              type,
              choicesResponse: correctIds.map((ix) => ({
                ix,
                selected: true,
              })),
            },
          ],
        },
        participantCtx(participantA.id)
      )
    ).resolves.toBe(fixture.activityInstance.id)
  })

  it('unlocks stages in order and completes after the last stage', async () => {
    const fixture = await seedGroupEscapeRoom()
    const [first, second] = fixture.groupActivity.stacks[0]!.elements
    const submit = (instanceId: number, participantId: string) =>
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(instanceId, 0)],
        },
        participantCtx(participantId)
      )

    await expect(
      submit(second!.id, fixture.participantA.id)
    ).rejects.toMatchObject({ extensions: { code: 'ESCAPE_ROOM_GATED' } })
    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [
            groupScResponse(first!.id, 0),
            groupScResponse(second!.id, 0),
          ],
        },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toMatchObject({ extensions: { code: 'ESCAPE_ROOM_GATED' } })

    await expect(submit(first!.id, fixture.participantA.id)).resolves.toBe(
      fixture.activityInstance.id
    )
    const afterFirst = await snapshotGroupEscapeRoom(fixture)
    expect(afterFirst.attempt.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
    expect(afterFirst.attempt.stageResponses).toEqual([
      expect.objectContaining({ instanceId: first!.id }),
    ])
    expect(afterFirst.activityInstance.decisionsSubmittedAt).toBeNull()

    const details = await getGroupActivityDetails(
      { activityId: fixture.groupActivity.id, groupId: fixture.group.id },
      participantCtx(fixture.participantB.id)
    )
    expect(details!.stacks[0]!.elements.map((element) => element.id)).toEqual([
      first!.id,
      second!.id,
    ])

    await expect(
      submit(first!.id, fixture.participantB.id)
    ).rejects.toMatchObject({ extensions: { code: 'ESCAPE_ROOM_GATED' } })
    await expect(submit(second!.id, fixture.participantB.id)).resolves.toBe(
      fixture.activityInstance.id
    )

    const state = await snapshotGroupEscapeRoom(fixture)
    expect(state.attempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
    expect(state.attempt.completedAt).not.toBeNull()
    expect(state.activityInstance.decisionsSubmittedAt).not.toBeNull()
    expect(state.activityInstance.decisions).toEqual([
      expect.objectContaining({ instanceId: first!.id }),
      expect.objectContaining({ instanceId: second!.id }),
    ])
  })

  it('hides stages after the current one from group members', async () => {
    const fixture = await seedGroupEscapeRoom()
    const [first] = fixture.groupActivity.stacks[0]!.elements

    const details = await getGroupActivityDetails(
      { activityId: fixture.groupActivity.id, groupId: fixture.group.id },
      participantCtx(fixture.participantA.id)
    )
    expect(details!.stacks[0]!.elements.map((element) => element.id)).toEqual([
      first!.id,
    ])
  })

  it('grades QR scan decisions against the private source code', async () => {
    const participantA = await seedParticipant('qr-group-a')
    const participantB = await seedParticipant('qr-group-b')
    const fixture = await seedEscapeRoomGroupActivity(
      {
        elements: [qrElement],
        courseId,
        participantIds: [participantA.id, participantB.id],
      },
      lecturerCtx
    )
    const instance = fixture.groupActivity.stacks[0]!.elements[0]!

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [qrResponse(instance.id, QR_SCAN_CODE)],
        },
        participantCtx(participantA.id)
      )
    ).resolves.toBe(fixture.activityInstance.id)

    const saved = await prisma.groupActivityInstance.findUniqueOrThrow({
      where: { id: fixture.activityInstance.id },
      select: { decisions: true },
    })
    expect(saved.decisions).toEqual([
      expect.objectContaining({ qrScanResponse: null }),
    ])

    const decoyParticipantA = await seedParticipant('qr-group-decoy-a')
    const decoyParticipantB = await seedParticipant('qr-group-decoy-b')
    const decoyFixture = await seedEscapeRoomGroupActivity(
      {
        elements: [qrElement],
        courseId,
        participantIds: [decoyParticipantA.id, decoyParticipantB.id],
      },
      lecturerCtx
    )
    const decoyInstance = decoyFixture.groupActivity.stacks[0]!.elements[0]!
    await expect(
      submitGroupActivityDecisions(
        {
          activityId: decoyFixture.activityInstance.id,
          responses: [qrResponse(decoyInstance.id, 'ZbCdEf12_-34')],
        },
        participantCtx(decoyParticipantA.id)
      )
    ).rejects.toMatchObject({ extensions: { code: 'ESCAPE_ROOM_LOCKOUT' } })
  })

  it('locks the team out on a wrong answer without clearing the stage', async () => {
    const fixture = await seedGroupEscapeRoom()
    const [first, second] = fixture.groupActivity.stacks[0]!.elements

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(first!.id, 1)],
        },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_LOCKOUT', lockoutRemainingSeconds: 5 },
    })

    const state = await snapshotGroupEscapeRoom(fixture)
    expect(state.activityInstance.decisions).toBeNull()
    expect(state.activityInstance.decisionsSubmittedAt).toBeNull()
    expect(state.attempt.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
    expect(state.attempt.lockoutUntil).not.toBeNull()
    expect(state.attempt.stageResponses).toEqual([])
    const totals = new Map(
      state.results.map((instance) => [
        instance.id,
        'total' in instance.results ? instance.results.total : 0,
      ])
    )
    expect(totals.get(first!.id)).toBe(1)
    expect(totals.get(second!.id)).toBe(0)

    await prisma.escapeRoomAttempt.update({
      where: { id: fixture.attempt.id },
      data: { lockoutUntil: new Date(Date.now() - 1_000) },
    })
    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: [groupScResponse(first!.id, 0)],
        },
        participantCtx(fixture.participantA.id)
      )
    ).resolves.toBe(fixture.activityInstance.id)
    expect((await snapshotGroupEscapeRoom(fixture)).attempt.status).toBe(
      DB.EscapeRoomStatus.IN_PROGRESS
    )
  })

  it('lets only one of two members clear the same stage concurrently', async () => {
    const fixture = await seedGroupEscapeRoom()
    const [first] = fixture.groupActivity.stacks[0]!.elements

    const results = await Promise.allSettled(
      [fixture.participantA, fixture.participantB].map((participant) =>
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: [groupScResponse(first!.id, 0)],
          },
          participantCtx(participant.id)
        )
      )
    )

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    const state = await snapshotGroupEscapeRoom(fixture)
    expect(state.attempt.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
    expect(state.attempt.stageResponses).toHaveLength(1)
    const firstResults = state.results.find(
      (instance) => instance.id === first!.id
    )!
    expect(
      'total' in firstResults.results ? firstResults.results.total : 0
    ).toBe(1)
  })
})
