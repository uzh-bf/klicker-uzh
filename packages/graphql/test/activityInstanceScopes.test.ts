import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PrismaClient,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
} from '@klicker-uzh/util'
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { manipulateGroupActivity } from '../src/services/groups.js'
import { manipulateLiveQuiz } from '../src/services/liveQuizzes.js'
import { manipulateMicroLearning } from '../src/services/microLearning.js'
import { manipulatePracticeQuiz } from '../src/services/practiceQuizzes.js'

type ActivityKind =
  | 'practiceQuiz'
  | 'microLearning'
  | 'liveQuiz'
  | 'groupActivity'

describe('activity instance edit scopes', () => {
  let prisma: PrismaClient
  const ownerIds: string[] = []

  beforeAll(() => {
    prisma = prismaClient
  })

  afterEach(async () => {
    const ids = ownerIds.splice(0)
    await prisma.course.deleteMany({ where: { ownerId: { in: ids } } })
    await prisma.element.deleteMany({ where: { ownerId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function fixture() {
    const ownerId = randomUUID()
    ownerIds.push(ownerId)
    const owner = await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.test`,
        shortname: `owner-${ownerId.slice(0, 8)}`,
      },
    })
    const now = new Date()
    const course = await prisma.course.create({
      data: {
        name: `course-${ownerId}`,
        displayName: 'Activity instance scope test',
        startDate: new Date(now.getTime() - 86_400_000),
        endDate: new Date(now.getTime() + 86_400_000),
        groupDeadlineDate: new Date(now.getTime() + 86_400_000),
        pinCode:
          (Number.parseInt(ownerId.replaceAll('-', '').slice(0, 8), 16) %
            9_000) +
          1_000,
        ownerId: owner.id,
      },
    })
    const element = await prisma.element.create({
      data: {
        type: ElementType.CONTENT,
        name: 'Content',
        content: 'Scoped content',
        options: {},
        ownerId: owner.id,
        permissions: {
          create: {
            userId: owner.id,
            permissionLevel: PermissionLevel.OWNER,
          },
        },
      },
    })
    const elementData = processElementData(element)
    const ctx = {
      user: {
        sub: owner.id,
        role: UserRole.USER,
        scope: UserLoginScope.ACCOUNT_OWNER,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
      prisma,
      emitter: { emit: vi.fn() },
    } as unknown as ContextWithUser

    return { course, ctx, element, elementData, now }
  }

  function instanceData({
    elementId,
    elementData,
    ownerId,
    type,
  }: {
    elementId: number
    elementData: ElementData
    ownerId: string
    type: ElementInstanceType
  }) {
    return {
      type,
      elementType: ElementType.CONTENT,
      order: 0,
      options: { pointsMultiplier: 1 },
      elementData,
      results: getInitialInstanceResults(elementData),
      anonymousResults: getInitialInstanceResults(elementData),
      elementId,
      ownerId,
    }
  }

  async function createActivity(
    kind: ActivityKind,
    data: Awaited<ReturnType<typeof fixture>>
  ) {
    const name = `${kind}-${randomUUID()}`
    if (kind === 'liveQuiz') {
      const activity = await prisma.liveQuiz.create({
        data: {
          name,
          displayName: name,
          status: PublicationStatus.DRAFT,
          ownerId: data.ctx.user.sub,
          courseId: data.course.id,
          blocks: {
            create: {
              order: 0,
              elements: {
                create: instanceData({
                  elementId: data.element.id,
                  elementData: data.elementData,
                  ownerId: data.ctx.user.sub,
                  type: ElementInstanceType.LIVE_QUIZ,
                }),
              },
            },
          },
        },
        include: { blocks: { include: { elements: true } } },
      })
      return {
        id: activity.id,
        instance: activity.blocks[0]!.elements[0]!,
        containerId: activity.blocks[0]!.id,
      }
    }

    const stackType =
      kind === 'practiceQuiz'
        ? ElementStackType.PRACTICE_QUIZ
        : kind === 'microLearning'
          ? ElementStackType.MICROLEARNING
          : ElementStackType.GROUP_ACTIVITY
    const instanceType =
      kind === 'practiceQuiz'
        ? ElementInstanceType.PRACTICE_QUIZ
        : kind === 'microLearning'
          ? ElementInstanceType.MICROLEARNING
          : ElementInstanceType.GROUP_ACTIVITY
    const stack = {
      order: 0,
      type: stackType,
      courseId: data.course.id,
      elements: {
        create: instanceData({
          elementId: data.element.id,
          elementData: data.elementData,
          ownerId: data.ctx.user.sub,
          type: instanceType,
        }),
      },
    }

    if (kind === 'practiceQuiz') {
      const activity = await prisma.practiceQuiz.create({
        data: {
          name,
          displayName: name,
          status: PublicationStatus.DRAFT,
          ownerId: data.ctx.user.sub,
          courseId: data.course.id,
          stacks: { create: stack },
        },
        include: { stacks: { include: { elements: true } } },
      })
      return {
        id: activity.id,
        instance: activity.stacks[0]!.elements[0]!,
        containerId: activity.stacks[0]!.id,
      }
    }

    if (kind === 'microLearning') {
      const activity = await prisma.microLearning.create({
        data: {
          name,
          displayName: name,
          status: PublicationStatus.DRAFT,
          scheduledStartAt: new Date(data.now.getTime() - 86_400_000),
          scheduledEndAt: new Date(data.now.getTime() + 86_400_000),
          ownerId: data.ctx.user.sub,
          courseId: data.course.id,
          stacks: { create: stack },
        },
        include: { stacks: { include: { elements: true } } },
      })
      return {
        id: activity.id,
        instance: activity.stacks[0]!.elements[0]!,
        containerId: activity.stacks[0]!.id,
      }
    }

    const activity = await prisma.groupActivity.create({
      data: {
        name,
        displayName: name,
        description: 'Task',
        status: PublicationStatus.DRAFT,
        scheduledStartAt: new Date(data.now.getTime() - 86_400_000),
        scheduledEndAt: new Date(data.now.getTime() + 86_400_000),
        ownerId: data.ctx.user.sub,
        courseId: data.course.id,
        stacks: { create: stack },
      },
      include: { stacks: { include: { elements: true } } },
    })
    return {
      id: activity.id,
      instance: activity.stacks[0]!.elements[0]!,
      containerId: activity.stacks[0]!.id,
    }
  }

  async function editActivity({
    activityId,
    ctx,
    data,
    instanceId,
    kind,
  }: {
    activityId: string
    ctx: ContextWithUser
    data: Awaited<ReturnType<typeof fixture>>
    instanceId: number
    kind: ActivityKind
  }) {
    const elementInput = {
      elementId: data.element.id,
      order: 0,
      existingInstanceId: instanceId,
      duplicateInstance: false,
    }
    const common = {
      id: activityId,
      name: `${kind}-edited`,
      displayName: `${kind} edited`,
      courseId: data.course.id,
      multiplier: 1,
    }

    if (kind === 'practiceQuiz') {
      return await manipulatePracticeQuiz(
        {
          ...common,
          stacks: [{ order: 0, elements: [elementInput] }],
          order: ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
        },
        ctx
      )
    }
    if (kind === 'microLearning') {
      return await manipulateMicroLearning(
        {
          ...common,
          stacks: [{ order: 0, elements: [elementInput] }],
          startDate: new Date(data.now.getTime() - 86_400_000),
          endDate: new Date(data.now.getTime() + 86_400_000),
        },
        ctx
      )
    }
    if (kind === 'liveQuiz') {
      return await manipulateLiveQuiz(
        {
          ...common,
          blocks: [{ order: 0, elements: [elementInput] }],
          isGamificationEnabled: false,
          isPinProtected: false,
          isConfusionFeedbackEnabled: false,
          isLiveQAEnabled: false,
          isModerationEnabled: false,
        },
        ctx
      )
    }
    return await manipulateGroupActivity(
      {
        ...common,
        description: 'Task',
        stack: { order: 0, elements: [elementInput] },
        clues: [],
        startDate: new Date(data.now.getTime() - 86_400_000),
        endDate: new Date(data.now.getTime() + 86_400_000),
      },
      ctx
    )
  }

  it.each<ActivityKind>([
    'practiceQuiz',
    'microLearning',
    'liveQuiz',
    'groupActivity',
  ])(
    'rejects a foreign persistent instance while editing a %s',
    async (kind) => {
      const data = await fixture()
      const target = await createActivity(kind, data)
      const source = await createActivity(kind, data)
      const transaction = vi
        .fn()
        .mockRejectedValue(new Error('Transaction should not be entered'))
      const preflightCtx = {
        ...data.ctx,
        prisma: new Proxy(prisma, {
          get(target, property) {
            if (property === '$transaction') return transaction
            return Reflect.get(target, property, target)
          },
        }),
      } as unknown as ContextWithUser

      await expect(
        editActivity({
          activityId: target.id,
          ctx: preflightCtx,
          data,
          instanceId: source.instance.id,
          kind,
        })
      ).rejects.toThrow('Not all element instances could be found')

      expect(transaction).not.toHaveBeenCalled()
      const persisted = await prisma.elementInstance.findUniqueOrThrow({
        where: { id: source.instance.id },
      })
      if (kind === 'liveQuiz') {
        expect(persisted.elementBlockId).toBe(source.containerId)
      } else {
        expect(persisted.elementStackId).toBe(source.containerId)
      }
    }
  )

  it.each<ActivityKind>([
    'practiceQuiz',
    'microLearning',
    'liveQuiz',
    'groupActivity',
  ])(
    'rejects a %s edit if the instance moves after preflight',
    async (kind) => {
      const data = await fixture()
      const target = await createActivity(kind, data)
      const source = await createActivity(kind, data)
      let raced = false
      const racedElementInstances = new Proxy(prisma.elementInstance, {
        get(delegate, property) {
          if (property === 'findMany') {
            return async (
              args: Parameters<typeof prisma.elementInstance.findMany>[0]
            ) => {
              const instances = await prisma.elementInstance.findMany(args)
              if (
                !raced &&
                instances.some((instance) => instance.id === target.instance.id)
              ) {
                raced = true
                await prisma.elementInstance.update({
                  where: { id: target.instance.id },
                  data:
                    kind === 'liveQuiz'
                      ? {
                          elementBlockId: source.containerId,
                          order: 1,
                        }
                      : {
                          elementStackId: source.containerId,
                          order: 1,
                        },
                })
              }
              return instances
            }
          }
          return Reflect.get(delegate, property, delegate)
        },
      })
      const racedPrisma = new Proxy(prisma, {
        get(target, property) {
          if (property === 'elementInstance') return racedElementInstances
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      const racedCtx = {
        ...data.ctx,
        prisma: racedPrisma,
      } as unknown as ContextWithUser

      await expect(
        editActivity({
          activityId: target.id,
          ctx: racedCtx,
          data,
          instanceId: target.instance.id,
          kind,
        })
      ).rejects.toThrow('Not all element instances could be found')

      expect(raced).toBe(true)
      const persisted = await prisma.elementInstance.findUniqueOrThrow({
        where: { id: target.instance.id },
      })
      if (kind === 'liveQuiz') {
        expect(persisted).toMatchObject({
          elementBlockId: source.containerId,
          order: 1,
        })
      } else {
        expect(persisted).toMatchObject({
          elementStackId: source.containerId,
          order: 1,
        })
      }
    }
  )
})
