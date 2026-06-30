import {
  PermissionLevel,
  PublicationStatus,
  ReviewStatus,
  type ElementInstance,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  recomputeDerivedPermissions,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import { randomIndex } from './responseIdentifiers.js'

const ASSESSMENT_PIN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export type ManageActivityBatchOperationsInput = {
  activityIds: string[]
  multiplier?: number | null
  courseId?: string | null
  basePoints?: number | null
  correctnessPoints?: number | null
  bonusPoints?: number | null
  timeToZeroBonus?: number | null
}

type BatchOperationElementInstance = Pick<
  ElementInstance,
  'elementData' | 'id' | 'options'
>

type InstanceWithMultiplier = BatchOperationElementInstance & {
  elementData: { pointsMultiplier: number }
  options: Record<string, unknown>
}

function generateAssessmentPinCode() {
  let pin = ''
  for (let ix = 0; ix < 6; ix++) {
    pin += ASSESSMENT_PIN_CHARS[randomIndex(ASSESSMENT_PIN_CHARS.length)]!
  }
  return pin
}

function hasInstanceMultiplier(
  instance: BatchOperationElementInstance
): instance is InstanceWithMultiplier {
  return (
    instance.options !== null &&
    typeof instance.options === 'object' &&
    !Array.isArray(instance.options) &&
    'pointsMultiplier' in instance.options &&
    instance.elementData !== null &&
    typeof instance.elementData === 'object' &&
    !Array.isArray(instance.elementData) &&
    'pointsMultiplier' in instance.elementData &&
    typeof (instance.elementData as { pointsMultiplier?: unknown })
      .pointsMultiplier === 'number'
  )
}

async function updateInstanceMultipliers(
  {
    instances,
    newActivityMultiplier,
  }: { instances: InstanceWithMultiplier[]; newActivityMultiplier: number },
  prisma: PrismaTransactionClient
) {
  await Promise.all(
    instances.map((instance) => {
      return prisma.elementInstance.update({
        where: { id: instance.id },
        data: {
          options: {
            ...instance.options,
            pointsMultiplier:
              instance.elementData.pointsMultiplier * newActivityMultiplier,
          },
        },
      })
    })
  )
}

export async function applyManageActivityBatchOperations(
  {
    activityIds,
    multiplier,
    courseId,
    basePoints,
    correctnessPoints,
    bonusPoints,
    timeToZeroBonus,
  }: ManageActivityBatchOperationsInput,
  {
    prisma,
    userId,
  }: {
    prisma: PrismaClient
    userId: string
  }
) {
  if (activityIds.length === 0) {
    return 0
  }

  const newCourse = courseId
    ? await prisma.course.findUnique({
        where: {
          id: courseId,
          permissions: {
            some: {
              userId,
              permissionLevel: {
                in: [
                  PermissionLevel.OWNER,
                  PermissionLevel.ADMIN,
                  PermissionLevel.WRITE,
                  PermissionLevel.EXECUTE,
                  PermissionLevel.READ,
                ],
              },
            },
          },
        },
      })
    : undefined

  if (
    courseId &&
    (!newCourse ||
      (typeof multiplier !== 'undefined' &&
        multiplier !== null &&
        !newCourse.isGamificationEnabled &&
        !newCourse.isAssessmentEnabled))
  ) {
    return 0
  }

  const requiredPermissionLevels = [
    PermissionLevel.WRITE,
    PermissionLevel.ADMIN,
    PermissionLevel.OWNER,
  ]

  const allowedActivityStatus = [
    PublicationStatus.DRAFT,
    PublicationStatus.SCHEDULED,
  ]

  const setLiveQuizPoints =
    typeof basePoints !== 'undefined' &&
    basePoints !== null &&
    typeof correctnessPoints !== 'undefined' &&
    correctnessPoints !== null &&
    typeof bonusPoints !== 'undefined' &&
    bonusPoints !== null &&
    typeof timeToZeroBonus !== 'undefined' &&
    timeToZeroBonus !== null

  const setMultiplier = typeof multiplier !== 'undefined' && multiplier !== null

  const liveQuizzes = await prisma.liveQuiz.findMany({
    where: {
      id: { in: activityIds },
      permissions: {
        some: {
          userId,
          permissionLevel: { in: requiredPermissionLevels },
        },
      },
      status: { in: allowedActivityStatus },
      AND: [
        ...((setMultiplier && !newCourse) || setLiveQuizPoints
          ? [
              {
                OR: [
                  { isGamificationEnabled: true },
                  { isAssessmentEnabled: true },
                ],
              },
            ]
          : []),
        {
          OR: [
            { courseId: null },
            { isAssessmentEnabled: false },
            {
              isAssessmentEnabled: true,
              course: {
                permissions: {
                  some: {
                    userId,
                    permissionLevel: {
                      in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    include: { blocks: { include: { elements: true } } },
  })

  const practiceQuizzes = !setLiveQuizPoints
    ? await prisma.practiceQuiz.findMany({
        where: {
          id: { in: activityIds },
          permissions: {
            some: {
              userId,
              permissionLevel: { in: requiredPermissionLevels },
            },
          },
          status: { in: allowedActivityStatus },
          AND: [
            ...(newCourse
              ? [
                  {
                    OR: [
                      { availableFrom: null },
                      {
                        availableFrom: {
                          gte: newCourse.startDate,
                          lte: newCourse.endDate,
                        },
                      },
                    ],
                  },
                ]
              : []),
            ...(setMultiplier && !newCourse
              ? [
                  {
                    OR: [
                      { isGamificationEnabled: true },
                      { isAssessmentEnabled: true },
                    ],
                  },
                ]
              : []),
            {
              OR: [
                { isAssessmentEnabled: false },
                {
                  isAssessmentEnabled: true,
                  course: {
                    permissions: {
                      some: {
                        userId,
                        permissionLevel: {
                          in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        include: { stacks: { include: { elements: true } } },
      })
    : []

  const microLearnings = !setLiveQuizPoints
    ? await prisma.microLearning.findMany({
        where: {
          id: { in: activityIds },
          permissions: {
            some: {
              userId,
              permissionLevel: { in: requiredPermissionLevels },
            },
          },
          status: { in: allowedActivityStatus },
          scheduledStartAt: newCourse
            ? { gte: newCourse.startDate }
            : undefined,
          scheduledEndAt: newCourse ? { lte: newCourse.endDate } : undefined,
          AND: [
            ...(setMultiplier && !newCourse
              ? [
                  {
                    OR: [
                      { isGamificationEnabled: true },
                      { isAssessmentEnabled: true },
                    ],
                  },
                ]
              : []),
            {
              OR: [
                { isAssessmentEnabled: false },
                {
                  isAssessmentEnabled: true,
                  course: {
                    permissions: {
                      some: {
                        userId,
                        permissionLevel: {
                          in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        include: { stacks: { include: { elements: true } } },
      })
    : []

  const groupActivities =
    !setLiveQuizPoints && (!newCourse || newCourse.isGroupCreationEnabled)
      ? await prisma.groupActivity.findMany({
          where: {
            id: { in: activityIds },
            permissions: {
              some: {
                userId,
                permissionLevel: { in: requiredPermissionLevels },
              },
            },
            status: { in: allowedActivityStatus },
            scheduledStartAt: newCourse
              ? { gte: newCourse.groupDeadlineDate }
              : undefined,
            scheduledEndAt: newCourse ? { lte: newCourse.endDate } : undefined,
            AND: [
              ...(setMultiplier && !newCourse
                ? [
                    {
                      OR: [
                        { isGamificationEnabled: true },
                        { isAssessmentEnabled: true },
                      ],
                    },
                  ]
                : []),
              {
                OR: [
                  { isAssessmentEnabled: false },
                  {
                    isAssessmentEnabled: true,
                    course: {
                      permissions: {
                        some: {
                          userId,
                          permissionLevel: {
                            in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                          },
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
          include: { stacks: { include: { elements: true } } },
        })
      : []

  const updatedLiveQuizzes: string[] = []
  const updatedPracticeQuizzes: string[] = []
  const updatedMicroLearnings: string[] = []
  const updatedGroupActivities: string[] = []

  for (const liveQuiz of liveQuizzes) {
    const updatedLiveQuiz = await prisma.$transaction(async (tx) => {
      const isCourseChanged = !!newCourse && liveQuiz.courseId !== newCourse.id

      let newPinCode: string | null = null
      if (isCourseChanged && newCourse.isAssessmentEnabled) {
        let pinValid = false

        for (let attempt = 0; attempt < 10; attempt++) {
          newPinCode = generateAssessmentPinCode()
          const existingLiveQuiz = await tx.liveQuiz.findUnique({
            where: { pinCode: newPinCode },
          })
          if (!existingLiveQuiz) {
            pinValid = true
            break
          }
        }

        if (!pinValid) {
          throw new Error('Could not find available pin code for live quiz')
        }
      }

      const modifiedLiveQuiz = await tx.liveQuiz.update({
        where: { id: liveQuiz.id },
        data: {
          course: isCourseChanged
            ? { connect: { id: newCourse!.id } }
            : undefined,
          isGamificationEnabled: isCourseChanged
            ? { set: newCourse!.isGamificationEnabled }
            : undefined,
          isAssessmentEnabled: isCourseChanged
            ? { set: newCourse!.isAssessmentEnabled }
            : undefined,
          pinCode: isCourseChanged ? newPinCode : undefined,
          pointsMultiplier: setMultiplier
            ? { set: Math.max(multiplier!, 1) }
            : undefined,
          defaultPoints: setLiveQuizPoints
            ? { set: Math.max(basePoints!, 0) }
            : undefined,
          defaultCorrectPoints: setLiveQuizPoints
            ? { set: Math.max(correctnessPoints!, 0) }
            : undefined,
          maxBonusPoints: setLiveQuizPoints
            ? { set: Math.max(bonusPoints!, 0) }
            : undefined,
          timeToZeroBonus: setLiveQuizPoints
            ? { set: Math.max(timeToZeroBonus!, 1) }
            : undefined,
          reviewStatus:
            liveQuiz.reviewStatus === ReviewStatus.REVIEWED
              ? {
                  set: isCourseChanged
                    ? ReviewStatus.INCOMPLETE
                    : ReviewStatus.MODIFIED_AFTER_REVIEW,
                }
              : undefined,
        },
      })

      if (setMultiplier) {
        await updateInstanceMultipliers(
          {
            instances: liveQuiz.blocks
              .flatMap((block) => block.elements)
              .filter(hasInstanceMultiplier),
            newActivityMultiplier: modifiedLiveQuiz.pointsMultiplier,
          },
          tx
        )
      }

      if (newCourse) {
        await recomputeDerivedPermissions(
          { liveQuizId: modifiedLiveQuiz.id },
          tx
        )
      }

      return modifiedLiveQuiz
    })

    updatedLiveQuizzes.push(updatedLiveQuiz.id)
  }

  if (!setLiveQuizPoints) {
    for (const practiceQuiz of practiceQuizzes) {
      const updatedPracticeQuiz = await prisma.$transaction(async (tx) => {
        const isCourseChanged =
          !!newCourse && practiceQuiz.courseId !== newCourse.id

        const modifiedPracticeQuiz = await tx.practiceQuiz.update({
          where: { id: practiceQuiz.id },
          data: {
            course: isCourseChanged
              ? { connect: { id: newCourse!.id } }
              : undefined,
            isGamificationEnabled: isCourseChanged
              ? { set: newCourse!.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: isCourseChanged
              ? { set: newCourse!.isAssessmentEnabled }
              : undefined,
            pointsMultiplier: setMultiplier ? { set: multiplier! } : undefined,
            reviewStatus:
              practiceQuiz.reviewStatus === ReviewStatus.REVIEWED
                ? {
                    set: isCourseChanged
                      ? ReviewStatus.INCOMPLETE
                      : ReviewStatus.MODIFIED_AFTER_REVIEW,
                  }
                : undefined,
          },
        })

        if (setMultiplier) {
          await updateInstanceMultipliers(
            {
              instances: practiceQuiz.stacks
                .flatMap((stack) => stack.elements)
                .filter(hasInstanceMultiplier),
              newActivityMultiplier: modifiedPracticeQuiz.pointsMultiplier,
            },
            tx
          )
        }

        if (newCourse) {
          await recomputeDerivedPermissions(
            { practiceQuizId: modifiedPracticeQuiz.id },
            tx
          )
        }

        return modifiedPracticeQuiz
      })

      updatedPracticeQuizzes.push(updatedPracticeQuiz.id)
    }

    for (const microLearning of microLearnings) {
      const updatedMicroLearning = await prisma.$transaction(async (tx) => {
        const isCourseChanged =
          !!newCourse && microLearning.courseId !== newCourse.id

        const modifiedMicroLearning = await tx.microLearning.update({
          where: { id: microLearning.id },
          data: {
            course: isCourseChanged
              ? { connect: { id: newCourse!.id } }
              : undefined,
            isGamificationEnabled: isCourseChanged
              ? { set: newCourse!.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: isCourseChanged
              ? { set: newCourse!.isAssessmentEnabled }
              : undefined,
            pointsMultiplier: setMultiplier ? { set: multiplier! } : undefined,
            reviewStatus:
              microLearning.reviewStatus === ReviewStatus.REVIEWED
                ? {
                    set: isCourseChanged
                      ? ReviewStatus.INCOMPLETE
                      : ReviewStatus.MODIFIED_AFTER_REVIEW,
                  }
                : undefined,
          },
        })

        if (setMultiplier) {
          await updateInstanceMultipliers(
            {
              instances: microLearning.stacks
                .flatMap((stack) => stack.elements)
                .filter(hasInstanceMultiplier),
              newActivityMultiplier: modifiedMicroLearning.pointsMultiplier,
            },
            tx
          )
        }

        if (newCourse) {
          await recomputeDerivedPermissions(
            { microLearningId: modifiedMicroLearning.id },
            tx
          )
        }

        return modifiedMicroLearning
      })

      updatedMicroLearnings.push(updatedMicroLearning.id)
    }

    for (const groupActivity of groupActivities) {
      const updatedGroupActivity = await prisma.$transaction(async (tx) => {
        const isCourseChanged =
          !!newCourse && groupActivity.courseId !== newCourse.id

        const modifiedGroupActivity = await tx.groupActivity.update({
          where: { id: groupActivity.id },
          data: {
            course: isCourseChanged
              ? { connect: { id: newCourse!.id } }
              : undefined,
            isGamificationEnabled: isCourseChanged
              ? { set: newCourse!.isGamificationEnabled }
              : undefined,
            isAssessmentEnabled: isCourseChanged
              ? { set: newCourse!.isAssessmentEnabled }
              : undefined,
            pointsMultiplier: setMultiplier ? { set: multiplier! } : undefined,
            reviewStatus:
              groupActivity.reviewStatus === ReviewStatus.REVIEWED
                ? {
                    set: isCourseChanged
                      ? ReviewStatus.INCOMPLETE
                      : ReviewStatus.MODIFIED_AFTER_REVIEW,
                  }
                : undefined,
          },
        })

        if (setMultiplier) {
          await updateInstanceMultipliers(
            {
              instances: groupActivity.stacks
                .flatMap((stack) => stack.elements)
                .filter(hasInstanceMultiplier),
              newActivityMultiplier: modifiedGroupActivity.pointsMultiplier,
            },
            tx
          )
        }

        if (newCourse) {
          await recomputeDerivedPermissions(
            { groupActivityId: modifiedGroupActivity.id },
            tx
          )
        }

        return modifiedGroupActivity
      })

      updatedGroupActivities.push(updatedGroupActivity.id)
    }
  }

  return (
    updatedLiveQuizzes.length +
    updatedPracticeQuizzes.length +
    updatedMicroLearnings.length +
    updatedGroupActivities.length
  )
}
