import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType, type ElementStackInput } from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { getPermissionBooleans } from './activities.js'
import { splitActivityInstances } from './liveQuizzes.js'

interface ManipulatePollArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: ElementStackInput[]
}

export async function manipulatePoll(
  { id, name, displayName, description, stacks }: ManipulatePollArgs,
  ctx: ContextWithUser
) {
  // in EDIT mode - validate that the poll exists and is not published
  let existingActivity: DB.Poll | null = null
  if (id) {
    existingActivity = await ctx.prisma.poll.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new GraphQLError('Poll not found')
    }
    if (existingActivity.status === DB.PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published poll')
    }
  }

  // get required splits of instances based on provided stacks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ stacksOrBlocks: stacks }, ctx)

  // in EDIT mode - check which instances and stacks should be removed
  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = [] // ids of all elements, which will no longer require a derived permissions link to the activity
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await ctx.prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { pollId: id },
      },
    })

    const stacks = await ctx.prisma.elementStack.findMany({
      where: { pollId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    areInstancesOutdated: anyInstanceOutdated,
    reviewStatus:
      existingActivity?.reviewStatus === DB.ReviewStatus.REVIEWED
        ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
        : undefined,
    stacks: {
      create: stacks.map((stack) => ({
        type: DB.ElementStackType.PRACTICE_QUIZ,
        order: stack.order,
        displayName: stack.displayName?.trim() ?? '',
        description: stack.description ?? '',
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: DB.ElementInstanceType.PRACTICE_QUIZ,
              activityMultiplier: 1, // answering polls does not yield points with multipliers
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
            })
          ),
        },
      })),
    },
  }

  const activity = await ctx.prisma.$transaction(
    async (prisma) => {
      // delete all instances that are not used anymore
      await prisma.elementInstance.deleteMany({
        where: { id: { in: instancesToDelete } },
      })

      // disconnect all instances that should be kept in edit mode and set new order value (to satisfy uniqueness constraints)
      for (const instance of persistentInstances) {
        await prisma.elementInstance.update({
          where: { id: instance.id },
          data: {
            elementStackId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...instance.options,
            },
          },
        })
      }

      // delete all stacks
      await prisma.elementStack.deleteMany({
        where: { id: { in: stacksToDelete } },
      })

      const upsertedPoll = await prisma.poll.upsert({
        where: { id: id ?? uuidv4() },
        create: {
          ...createOrUpdateJSON,
          owner: { connect: { id: ctx.user.sub } }, // only connect the owner during activity creation (not editing)!
        },
        update: createOrUpdateJSON,
        include: {
          templateInfo: true,
          permissions: {
            where: { userId: ctx.user.sub },
            include: { directPermission: true },
            take: 1,
          },
          stacks: {
            include: { _count: { select: { elements: true } } },
            orderBy: { order: 'asc' },
          },
          _count: { select: { permissions: true } },
        },
      })

      // enforce dervied permissions update to elements that were potentially removed from the poll (-> removal of derived permissions)
      if (unlinkedElementIds.length > 0) {
        for (const elementId of unlinkedElementIds) {
          await recomputeDerivedPermissions({ elementId }, prisma)
        }
      }

      await recomputeDerivedPermissions({ pollId: upsertedPoll.id }, prisma)

      return upsertedPoll
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'Poll',
    id,
  })

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? DB.PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = getPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission:
      activity.permissions[0]?.directPermission &&
      activity.permissions[0].directPermission.userGroupId !== null,
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.POLL,
    status: activity.status,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, block) => acc + block._count.elements,
      0
    ),
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: false, // activity reviewer through course is not available due to lack of course assignment
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

export async function getSinglePoll({ id }: { id: string }, ctx: Context) {
  const poll = await ctx.prisma.poll.findUnique({
    where: { id, isDeleted: false },
    include: {
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return poll
}
