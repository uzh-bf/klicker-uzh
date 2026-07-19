import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  QR_SCAN_CODE,
  TEST_PREFIX,
  courseId,
  createdElementIds,
  createdParticipantIds,
  groupScResponse,
  lecturerCtx,
  participantCtx,
  prisma,
  qrElement,
  qrResponse,
  scElement,
  seedEscapeRoomGroupActivity,
  seedParticipant,
  submitGroupActivityDecisions,
} from './escapeRoomTestHarness.js'

describe('submitGroupActivityDecisions - exact atomic escape submission', () => {
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
    ).then((fixture) => ({ ...fixture, participantA }))
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
        select: { status: true, completedAt: true, lockoutUntil: true },
      }),
    }
  }

  it.each(['empty', 'partial', 'duplicate', 'foreign'] as const)(
    'rejects a %s response set without changing any escape-room state',
    async (kind) => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      const foreignFixture =
        kind === 'foreign' ? await seedGroupEscapeRoom() : null
      const responses =
        kind === 'empty'
          ? []
          : kind === 'partial'
            ? [groupScResponse(instances[0]!.id, 0)]
            : kind === 'duplicate'
              ? [
                  groupScResponse(instances[0]!.id, 0),
                  groupScResponse(instances[0]!.id, 0),
                ]
              : [
                  groupScResponse(instances[0]!.id, 0),
                  groupScResponse(
                    foreignFixture!.groupActivity.stacks[0]!.elements[0]!.id,
                    0
                  ),
                ]
      const before = await snapshotGroupEscapeRoom(fixture)

      await expect(
        submitGroupActivityDecisions(
          { activityId: fixture.activityInstance.id, responses },
          participantCtx(fixture.participantA.id)
        )
      ).rejects.toThrow(
        'Group activity responses must exactly match the required instances'
      )

      expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
    }
  )

  it('rejects malformed response payloads before changing any state', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const malformed = instances.map((instance) =>
      groupScResponse(instance.id, 0)
    )
    const malformedChoice = malformed[1]!.choicesResponse[0] as { ix: number }
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
          responses: instances.map((instance) =>
            groupScResponse(instance.id, 0)
          ),
        },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toThrow(
      'Escape room group activity instances require sample solutions'
    )

    expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
  })

  it('rolls back an earlier result update when a later instance update fails', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    await prisma.elementInstance.update({
      where: { id: instances[1]!.id },
      data: { results: {} as any },
    })
    const before = await snapshotGroupEscapeRoom(fixture)

    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: instances.map((instance) =>
            groupScResponse(instance.id, 0)
          ),
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
          responses: instances.map((instance) =>
            groupScResponse(instance.id, 0)
          ),
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
    })

    await expect(
      submitGroupActivityDecisions(
        { activityId: fixture.activityInstance.id, responses: [] },
        participantCtx(participantA.id)
      )
    ).rejects.toThrow(
      'Group activity responses must exactly match the required instances'
    )

    expect(await snapshotGroupEscapeRoom({ ...fixture, participantA })).toEqual(
      before
    )
  })

  it.each([
    { label: 'SC', type: DB.ElementType.SC, correctIds: [0] },
    { label: 'MC', type: DB.ElementType.MC, correctIds: [0, 2] },
    { label: 'KPRIM mixed', type: DB.ElementType.KPRIM, correctIds: [0, 2] },
    { label: 'KPRIM all false', type: DB.ElementType.KPRIM, correctIds: [] },
  ])(
    'accepts production-shaped selected-only $label responses',
    async ({ label, type, correctIds }) => {
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
    }
  )

  it('completes once for a valid exact response set', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const responses = instances.map((instance) =>
      groupScResponse(instance.id, 0)
    )

    await expect(
      submitGroupActivityDecisions(
        { activityId: fixture.activityInstance.id, responses },
        participantCtx(fixture.participantA.id)
      )
    ).resolves.toBe(fixture.activityInstance.id)

    const state = await snapshotGroupEscapeRoom(fixture)
    expect(state.activityInstance.decisionsSubmittedAt).not.toBeNull()
    expect(state.attempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
    expect(state.attempt.completedAt).not.toBeNull()
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

  it('commits incorrect results and lockout without finalizing decisions', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const responses = [
      groupScResponse(instances[0]!.id, 1),
      groupScResponse(instances[1]!.id, 0),
    ]

    await expect(
      submitGroupActivityDecisions(
        { activityId: fixture.activityInstance.id, responses },
        participantCtx(fixture.participantA.id)
      )
    ).rejects.toMatchObject({
      message: 'Some answers are incorrect. You are locked out.',
      extensions: {
        code: 'ESCAPE_ROOM_LOCKOUT',
        lockoutRemainingSeconds: 5,
      },
    })

    const state = await snapshotGroupEscapeRoom(fixture)
    expect(state.activityInstance.decisions).toBeNull()
    expect(state.activityInstance.decisionsSubmittedAt).toBeNull()
    expect(state.attempt.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
    expect(state.attempt.lockoutUntil).not.toBeNull()
    for (const instance of state.results) {
      expect('total' in instance.results ? instance.results.total : 0).toBe(1)
    }

    await prisma.escapeRoomAttempt.update({
      where: { id: fixture.attempt.id },
      data: { lockoutUntil: new Date(Date.now() - 1_000) },
    })
    await expect(
      submitGroupActivityDecisions(
        {
          activityId: fixture.activityInstance.id,
          responses: instances.map((instance) =>
            groupScResponse(instance.id, 0)
          ),
        },
        participantCtx(fixture.participantA.id)
      )
    ).resolves.toBe(fixture.activityInstance.id)
    expect(
      await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: fixture.attempt.id },
        select: { status: true },
      })
    ).toEqual({ status: DB.EscapeRoomStatus.COMPLETED })
  })

  it('allows only one of two concurrent valid submissions to mutate state', async () => {
    const fixture = await seedGroupEscapeRoom()
    const instances = fixture.groupActivity.stacks[0]!.elements
    const responses = instances.map((instance) =>
      groupScResponse(instance.id, 0)
    )

    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        submitGroupActivityDecisions(
          { activityId: fixture.activityInstance.id, responses },
          participantCtx(fixture.participantA.id)
        )
      )
    )

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1)
    const state = await snapshotGroupEscapeRoom(fixture)
    expect(state.attempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
    for (const instance of state.results) {
      expect('total' in instance.results ? instance.results.total : 0).toBe(1)
    }
  })
})
