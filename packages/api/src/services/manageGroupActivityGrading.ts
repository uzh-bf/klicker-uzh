import {
  LeaderboardType,
  PublicationStatus,
  TimelineEntryType,
  type ElementInstance,
  type ElementStack,
  type GroupActivity,
  type GroupActivityClue,
  type GroupActivityInstance,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  ResponseCorrectness,
  type ElementInstanceOptions,
  type GroupActivityGradingInput,
  type GroupActivityResults,
} from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'

const POINTS_PER_GROUP_ACTIVITY_ELEMENT = 25

type GroupActivityGradingElement = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'id' | 'options' | 'type'
>

type GroupActivityGradingStack = Pick<
  ElementStack,
  'description' | 'displayName' | 'id'
> & {
  elements?: GroupActivityGradingElement[] | null
}

type GroupActivityGradingInstance = Pick<
  GroupActivityInstance,
  | 'decisions'
  | 'decisionsSubmittedAt'
  | 'groupActivityId'
  | 'id'
  | 'results'
  | 'resultsComputedAt'
> & {
  groupName: string
}

export type GroupActivityGradingSource = Pick<
  GroupActivity,
  | 'description'
  | 'displayName'
  | 'id'
  | 'name'
  | 'pointsMultiplier'
  | 'scheduledEndAt'
  | 'scheduledStartAt'
  | 'status'
> & {
  activityInstances?: GroupActivityGradingInstance[] | null
  clues?: GroupActivityClue[] | null
  stacks?: GroupActivityGradingStack[] | null
}

type GroupActivityInstanceWithResults = Pick<
  GroupActivityInstance,
  'decisions' | 'groupId' | 'id' | 'results'
>

function getElementInstanceOptions(
  instance: Pick<ElementInstance, 'options'>
): ElementInstanceOptions {
  return instance.options as ElementInstanceOptions
}

function getGroupActivityResults(
  instance: Pick<GroupActivityInstance, 'results'>
): GroupActivityResults | null {
  return instance.results as GroupActivityResults | null
}

async function upsertDailyTimelineEntry({
  prisma,
  participantId,
  courseId,
  xpAwarded,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  xpAwarded?: number
  pointsAwarded?: number
}) {
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
  })

  if (!participation) return

  await prisma.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: participation.id,
        courseId,
        timestamp: new Date(),
        type: TimelineEntryType.DAILY,
      },
    },
    create: {
      type: TimelineEntryType.DAILY,
      timestamp: new Date(),
      collectedPoints: participation.isActive ? pointsAwarded : 0,
      collectedXp: xpAwarded,
      computedAt: new Date(),
      course: {
        connect: {
          id: courseId,
        },
      },
      participation: {
        connect: {
          id: participation.id,
        },
      },
    },
    update: {
      collectedPoints:
        typeof pointsAwarded === 'number'
          ? { increment: pointsAwarded }
          : undefined,
      collectedXp:
        typeof xpAwarded === 'number' ? { increment: xpAwarded } : undefined,
      computedAt: new Date(),
    },
  })
}

export async function getGradingGroupActivity({
  prisma,
  id,
}: {
  prisma: PrismaClient
  id: string
}): Promise<GroupActivityGradingSource | null> {
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id },
    include: {
      clues: true,
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
      activityInstances: {
        include: { group: true },
        orderBy: { decisionsSubmittedAt: 'asc' },
      },
    },
  })

  if (!groupActivity) return null

  return {
    ...groupActivity,
    activityInstances: groupActivity.activityInstances.map(
      ({ group, ...instance }) => ({
        ...instance,
        groupName: group.name,
      })
    ),
  }
}

export async function gradeGroupActivitySubmission({
  prisma,
  id,
  gradingDecisions,
}: {
  prisma: PrismaClient
  id: number
  gradingDecisions: GroupActivityGradingInput
}) {
  const instanceIds = gradingDecisions.grading.map(
    (result) => result.instanceId
  )

  const elementInstances = await prisma.elementInstance.findMany({
    where: { id: { in: instanceIds } },
    select: { id: true, options: true },
  })

  const elementInstanceMap = elementInstances.reduce<
    Record<number, ElementInstanceOptions>
  >(
    (acc, instance) => ({
      ...acc,
      [instance.id]: getElementInstanceOptions(instance),
    }),
    {}
  )

  return prisma.groupActivityInstance.update({
    where: { id },
    data: {
      results: {
        passed: gradingDecisions.passed,
        points: gradingDecisions.grading.reduce(
          (acc, result) => acc + result.score,
          0
        ),
        comment: gradingDecisions.comment,
        grading: gradingDecisions.grading.map((result) => {
          const computedMaxPoints =
            POINTS_PER_GROUP_ACTIVITY_ELEMENT *
            (elementInstanceMap[result.instanceId]?.pointsMultiplier ?? 1)

          return {
            instanceId: result.instanceId,
            score: Math.min(result.score, computedMaxPoints),
            maxPoints: computedMaxPoints,
            feedback: result.feedback,
            correctness:
              result.score === 0
                ? ResponseCorrectness.INCORRECT
                : result.score < computedMaxPoints
                  ? ResponseCorrectness.PARTIAL
                  : ResponseCorrectness.CORRECT,
          }
        }),
      },
    },
  })
}

export async function finalizeGroupActivityGrading({
  prisma,
  id,
}: {
  prisma: PrismaClient
  id: string
}) {
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id },
    include: { activityInstances: true },
  })

  if (!groupActivity) return null

  const solvedInstances = groupActivity.activityInstances.filter(
    (instance) => instance.decisions
  )

  if (!solvedInstances.every((instance) => instance.results)) {
    return null
  }

  const updatedGroupActivity = await prisma.groupActivity.update({
    where: { id },
    data: {
      status: PublicationStatus.GRADED,
      activityInstances: {
        updateMany: {
          where: {
            id: {
              in: solvedInstances.map((instance) => instance.id),
            },
          },
          data: {
            resultsComputedAt: new Date(),
          },
        },
      },
    },
    include: {
      activityInstances: {
        include: {
          group: {
            include: {
              participants: {
                include: {
                  leaderboards: {
                    where: {
                      type: LeaderboardType.COURSE,
                      courseId: groupActivity.courseId,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (
    updatedGroupActivity.activityInstances.length === 0 ||
    updatedGroupActivity.activityInstances.some(
      (instance) => instance.decisions && !instance.results
    )
  ) {
    return updatedGroupActivity
  }

  const gradedInstances = updatedGroupActivity.activityInstances.filter(
    (
      instance
    ): instance is typeof instance & GroupActivityInstanceWithResults =>
      Boolean(instance.results)
  )

  const participantAchievementMap = gradedInstances.reduce<
    Record<string, { leaderboard: boolean; achievements: number[] }>
  >((acc, instance) => {
    instance.group.participants.forEach((participant) => {
      acc[participant.id] = {
        achievements: [9],
        leaderboard: participant.leaderboards.length > 0,
      }
      if (getGroupActivityResults(instance)?.passed) {
        acc[participant.id]!.achievements.push(8)
      }
    })

    return acc
  }, {})

  await prisma.$transaction(async (tx) => {
    for (const instance of gradedInstances) {
      await tx.participantGroup.update({
        where: { id: instance.groupId },
        data: {
          groupActivityScore: {
            increment: getGroupActivityResults(instance)?.points ?? 0,
          },
        },
      })
    }

    for (const [participantId, results] of Object.entries(
      participantAchievementMap
    )) {
      let pointsAwarded: number | undefined = undefined
      let xpAwarded: number | undefined = undefined

      for (const achievementId of results.achievements) {
        await tx.participantAchievementInstance.upsert({
          where: {
            participantId_achievementId: {
              participantId,
              achievementId,
            },
          },
          create: {
            participantId,
            achievementId,
            achievedAt: new Date(),
            achievedCount: 1,
          },
          update: {
            achievedCount: {
              increment: 1,
            },
          },
        })

        if (achievementId === 9) {
          await tx.participant.update({
            where: { id: participantId },
            data: { xp: { increment: 250 } },
          })

          xpAwarded = (xpAwarded ?? 0) + 250
        }

        if (achievementId === 8) {
          await tx.participant.update({
            where: { id: participantId },
            data: { xp: { increment: 1000 } },
          })

          xpAwarded = (xpAwarded ?? 0) + 1000

          if (results.leaderboard) {
            await tx.leaderboardEntry.update({
              where: {
                type_participantId_courseId: {
                  type: LeaderboardType.COURSE,
                  participantId,
                  courseId: updatedGroupActivity.courseId,
                },
              },
              data: {
                score: {
                  increment: 500,
                },
              },
            })

            pointsAwarded = (pointsAwarded ?? 0) + 500
          }
        }
      }

      await upsertDailyTimelineEntry({
        prisma: tx,
        participantId,
        courseId: updatedGroupActivity.courseId,
        pointsAwarded,
        xpAwarded,
      })
    }
  })

  return updatedGroupActivity
}
