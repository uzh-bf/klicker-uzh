import {
  ActivityLogType,
  ObjectType,
  PermissionLevel,
  type Prisma,
} from '@klicker-uzh/prisma/client'
import { getPrisma } from '../context.js'
import { toActivityLogEntry } from '../dto/sharing.js'
import { router } from '../init.js'
import { hasObjectPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  activityLogEntryInput,
  addActivityMessageInput,
  objectActivityInput,
} from '../schemas/sharing.js'

type ActivityLogObjectFields = Pick<
  Prisma.ActivityLogEntryUncheckedCreateInput,
  | 'answerCollectionId'
  | 'elementId'
  | 'courseId'
  | 'liveQuizId'
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'
>

function parseNumericObjectId(objectId: string) {
  const parsedObjectId = Number.parseInt(objectId, 10)

  return Number.isNaN(parsedObjectId) ? null : parsedObjectId
}

function getActivityLogObjectFields({
  objectId,
  objectType,
}: {
  objectId: string
  objectType: ObjectType
}): ActivityLogObjectFields | null {
  switch (objectType) {
    case ObjectType.ANSWER_COLLECTION: {
      const answerCollectionId = parseNumericObjectId(objectId)
      return answerCollectionId === null ? null : { answerCollectionId }
    }
    case ObjectType.ELEMENT: {
      const elementId = parseNumericObjectId(objectId)
      return elementId === null ? null : { elementId }
    }
    case ObjectType.COURSE:
      return { courseId: objectId }
    case ObjectType.LIVE_QUIZ:
      return { liveQuizId: objectId }
    case ObjectType.PRACTICE_QUIZ:
      return { practiceQuizId: objectId }
    case ObjectType.MICRO_LEARNING:
      return { microLearningId: objectId }
    case ObjectType.GROUP_ACTIVITY:
      return { groupActivityId: objectId }
    case ObjectType.CATALOG_COLLECTION:
    case ObjectType.USER_GROUP:
      return null
  }
}

export const sharingRouter = router({
  objectActivity: userProcedure
    .input(objectActivityInput)
    .query(async ({ ctx, input }) => {
      const objectFields = getActivityLogObjectFields(input)

      if (!objectFields) return { objectActivity: null }

      const canRead = await hasObjectPermission(
        ctx,
        input,
        PermissionLevel.READ
      )

      if (!canRead) return { objectActivity: null }

      const prisma = getPrisma(ctx)
      const activityLog = await prisma.activityLogEntry.findMany({
        where: objectFields,
        include: { user: { select: { shortname: true } } },
        orderBy: { createdAt: 'asc' },
      })

      return {
        objectActivity: activityLog.map((entry) =>
          toActivityLogEntry(entry, ctx.user.sub)
        ),
      }
    }),

  addActivityMessage: userFullAccessProcedure
    .input(addActivityMessageInput)
    .mutation(async ({ ctx, input }) => {
      const objectFields = getActivityLogObjectFields(input)

      if (!objectFields) return { activityMessage: null }

      const canRead = await hasObjectPermission(
        ctx,
        input,
        PermissionLevel.READ
      )

      if (!canRead) return { activityMessage: null }

      const prisma = getPrisma(ctx)
      const activityMessage = await prisma.activityLogEntry.create({
        data: {
          type: ActivityLogType.MESSAGE,
          message: input.message,
          objectType: input.objectType,
          ...objectFields,
          userId: ctx.user.sub,
        },
        include: { user: { select: { shortname: true } } },
      })

      return {
        activityMessage: toActivityLogEntry(activityMessage, ctx.user.sub),
      }
    }),

  deleteActivityMessage: userFullAccessProcedure
    .input(activityLogEntryInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const activityMessage = await prisma.activityLogEntry.findUnique({
        where: { id: input.id },
      })

      if (!activityMessage || activityMessage.userId !== ctx.user.sub) {
        return { deleted: false }
      }

      await prisma.activityLogEntry.delete({
        where: { id: input.id, userId: ctx.user.sub },
      })

      return { deleted: true }
    }),

  resolveActivityLogEntry: userFullAccessProcedure
    .input(activityLogEntryInput)
    .mutation(() => {
      return { activityLogEntry: null }
    }),
})
