import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  ParameterType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  prisma?: TRPCContext['prisma']
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    prisma,
    user: {
      sub,
      role,
    },
  }
}

function createPublishedActivity() {
  return {
    id: 'activity-1',
    status: PublicationStatus.PUBLISHED,
    scheduledStartAt: new Date(Date.now() - 60_000),
    scheduledEndAt: new Date(Date.now() + 60_000),
    clues: [
      {
        name: 'clue-a',
        displayName: 'Clue A',
        type: ParameterType.STRING,
        unit: null,
        value: 'A',
      },
      {
        name: 'clue-b',
        displayName: 'Clue B',
        type: ParameterType.NUMBER,
        unit: 'kg',
        value: '42',
      },
    ],
  }
}

function createSubmittableActivityInstance() {
  return {
    id: 33,
    decisionsSubmittedAt: null,
    group: {
      participants: [{ id: 'participant-1' }],
    },
    groupActivity: {
      status: PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(Date.now() - 60_000),
      scheduledEndAt: new Date(Date.now() + 60_000),
    },
  }
}

function createDetailActivity() {
  return {
    id: 'activity-1',
    displayName: 'Group Activity',
    status: PublicationStatus.PUBLISHED,
    description: 'Solve together.',
    scheduledStartAt: new Date('2026-01-01T10:00:00.000Z'),
    scheduledEndAt: new Date('2026-01-01T11:00:00.000Z'),
    clues: [{ id: 1, displayName: 'Initial clue' }],
    course: {
      id: 'course-1',
      displayName: 'Course',
      color: '#335577',
    },
    stacks: [
      {
        id: 21,
        type: ElementStackType.GROUP_ACTIVITY,
        displayName: 'Stack',
        description: 'Stack description',
        order: 0,
        elements: [
          {
            id: 101,
            type: ElementInstanceType.GROUP_ACTIVITY,
            elementType: ElementType.SC,
            elementData: {
              id: '383-v2',
              elementId: 383,
              name: 'Single Choice',
              type: ElementType.SC,
              content: 'Question content',
              explanation: null,
              basePoints: true,
              pointsMultiplier: 1,
              options: {
                hasSampleSolution: true,
                displayMode: 'LIST',
                choices: [
                  { ix: 0, value: '50%', correct: true },
                  { ix: 1, value: '100%', correct: false },
                ],
              },
            },
          },
        ],
      },
    ],
  }
}

function createDetailGroup(
  participantIds = ['participant-1', 'participant-2']
) {
  return {
    id: 'group-1',
    name: 'Group 1',
    participants: participantIds.map((id) => ({
      id,
      username: id,
      avatar: null,
    })),
  }
}

function createDetailActivityInstance() {
  return {
    id: 33,
    decisionsSubmittedAt: null,
    decisions: [
      {
        instanceId: 101,
        type: ElementType.SC,
        choicesResponse: [{ ix: 0, selected: true }],
      },
    ],
    resultsComputedAt: null,
    results: null,
    clueInstanceAssignment: [
      {
        participantId: 'participant-1',
        groupActivityClueInstance: {
          id: 501,
          displayName: 'Self clue',
          type: ParameterType.STRING,
          unit: null,
          value: 'visible',
        },
        participant: {
          id: 'participant-1',
          username: 'participant-1',
          avatar: null,
        },
      },
      {
        participantId: 'participant-2',
        groupActivityClueInstance: {
          id: 502,
          displayName: 'Other clue',
          type: ParameterType.STRING,
          unit: null,
          value: 'hidden',
        },
        participant: {
          id: 'participant-2',
          username: 'participant-2',
          avatar: null,
        },
      },
    ],
  }
}

describe('participant group activity routers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('starts a published group activity for a group member', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const create = vi.fn().mockResolvedValue({
      id: 11,
      clues: [{ id: 101 }, { id: 102 }],
    })
    const update = vi.fn().mockResolvedValue({ id: 11 })
    const tx = {
      groupActivityInstance: {
        create,
        update,
      },
    }
    const transaction = vi.fn(async (fn) => fn(tx))
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createPublishedActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-1' }, { id: 'participant-2' }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.startGroupActivity({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({
      groupActivity: {
        id: 'activity-1',
        status: PublicationStatus.PUBLISHED,
        activityInstance: { id: 11 },
      },
    })

    expect(prisma?.groupActivity.findUnique).toHaveBeenCalledWith({
      where: { id: 'activity-1', status: PublicationStatus.PUBLISHED },
      select: expect.objectContaining({
        clues: expect.objectContaining({
          orderBy: { displayName: 'asc' },
        }),
      }),
    })
    expect(prisma?.participantGroup.findUnique).toHaveBeenCalledWith({
      where: { id: 'group-1' },
      select: {
        participants: {
          select: { id: true },
        },
      },
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        group: { connect: { id: 'group-1' } },
        groupActivity: { connect: { id: 'activity-1' } },
        clues: { create: createPublishedActivity().clues },
      },
      select: {
        id: true,
        clues: {
          select: { id: true },
        },
      },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        clueInstanceAssignment: {
          create: expect.arrayContaining([
            expect.objectContaining({
              groupActivityClueInstance: { connect: { id: 101 } },
            }),
            expect.objectContaining({
              groupActivityClueInstance: { connect: { id: 102 } },
            }),
          ]),
        },
      },
      select: { id: true },
    })
    expect(transaction).toHaveBeenCalledOnce()
  })

  test('returns null when the participant is not a group member', async () => {
    const transaction = vi.fn()
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createPublishedActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-2' }, { id: 'participant-3' }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.startGroupActivity({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({ groupActivity: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('returns null when the group has fewer than two participants', async () => {
    const transaction = vi.fn()
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createPublishedActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue({
          participants: [{ id: 'participant-1' }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.startGroupActivity({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({ groupActivity: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('returns group activity details for a group member and masks other clues', async () => {
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createDetailActivity()),
      },
      participantGroup: {
        findUnique: vi.fn().mockResolvedValue(createDetailGroup()),
      },
      groupActivityInstance: {
        findUnique: vi.fn().mockResolvedValue(createDetailActivityInstance()),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    const result = await caller.participant.groupActivityDetails({
      activityId: 'activity-1',
      groupId: 'group-1',
    })

    expect(result).toMatchObject({
      groupActivityDetails: {
        id: 'activity-1',
        displayName: 'Group Activity',
        course: { id: 'course-1', displayName: 'Course' },
        group: {
          id: 'group-1',
          participants: [
            { id: 'participant-1', isSelf: true },
            { id: 'participant-2', isSelf: false },
          ],
        },
        activityInstance: {
          id: 33,
          decisions: [
            {
              instanceId: 101,
              type: ElementType.SC,
              choicesResponse: [{ ix: 0, selected: true }],
              contentResponse: null,
            },
          ],
          clues: [
            {
              id: 501,
              displayName: 'Self clue',
              value: 'visible',
              participant: { id: 'participant-1', isSelf: true },
            },
            {
              id: 502,
              displayName: 'Other clue',
              participant: { id: 'participant-2', isSelf: false },
            },
          ],
        },
        stacks: [
          {
            id: 21,
            elements: [
              {
                id: 101,
                elementData: {
                  __typename: 'ChoicesElementData',
                  options: {
                    choices: [
                      { ix: 0, value: '50%' },
                      { ix: 1, value: '100%' },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    })
    expect(
      result.groupActivityDetails?.activityInstance?.clues?.[1]
    ).not.toHaveProperty('value')
  })

  test('returns null group activity details for a non-member group', async () => {
    const activityInstanceFindUnique = vi.fn()
    const prisma = {
      groupActivity: {
        findUnique: vi.fn().mockResolvedValue(createDetailActivity()),
      },
      participantGroup: {
        findUnique: vi
          .fn()
          .mockResolvedValue(createDetailGroup(['participant-2'])),
      },
      groupActivityInstance: {
        findUnique: activityInstanceFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.groupActivityDetails({
        activityId: 'activity-1',
        groupId: 'group-1',
      })
    ).resolves.toEqual({ groupActivityDetails: null })

    expect(activityInstanceFindUnique).not.toHaveBeenCalled()
  })

  test('submits group activity decisions and updates aggregate instance results', async () => {
    const elementInstanceUpdate = vi.fn()
    const tx = {
      elementInstance: {
        findUnique: vi.fn().mockResolvedValue({
          elementData: { type: ElementType.SC },
          results: { choices: { 0: 0, 1: 0 }, total: 0 },
        }),
        update: elementInstanceUpdate,
      },
    }
    const transaction = vi.fn(async (fn) => fn(tx))
    const activityInstanceUpdate = vi.fn().mockResolvedValue({ id: 33 })
    const prisma = {
      groupActivityInstance: {
        findUnique: vi
          .fn()
          .mockResolvedValue(createSubmittableActivityInstance()),
        update: activityInstanceUpdate,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.submitGroupActivityDecisions({
        activityId: 33,
        responses: [
          {
            instanceId: 101,
            type: ElementType.SC,
            choicesResponse: [{ ix: 1, selected: true }],
          },
        ],
      })
    ).resolves.toEqual({ groupActivityInstanceId: 33 })

    expect(transaction).toHaveBeenCalledOnce()
    expect(elementInstanceUpdate).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        results: { choices: { 0: 0, 1: 1 }, total: 1 },
      },
    })
    expect(activityInstanceUpdate).toHaveBeenCalledWith({
      where: { id: 33 },
      data: {
        decisions: [
          {
            instanceId: 101,
            type: ElementType.SC,
            choicesResponse: [{ ix: 1, selected: true }],
          },
        ],
        decisionsSubmittedAt: expect.any(Date),
      },
      select: { id: true },
    })
  })

  test('returns null when submitting decisions for a non-member group', async () => {
    const transaction = vi.fn()
    const prisma = {
      groupActivityInstance: {
        findUnique: vi.fn().mockResolvedValue({
          ...createSubmittableActivityInstance(),
          group: { participants: [] },
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.submitGroupActivityDecisions({
        activityId: 33,
        responses: [],
      })
    ).resolves.toEqual({ groupActivityInstanceId: null })

    expect(transaction).not.toHaveBeenCalled()
  })
})
