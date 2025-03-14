import * as DB from '@klicker-uzh/prisma'
import {
  ActivityType,
  CaseStudyElementData,
  SelectionElementData,
} from '@klicker-uzh/types'
import { getInitialInstanceStatistics } from '@klicker-uzh/util'
import { v4 as uuidv4 } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'

// ! Helper functions
// #region

export async function validateActivityPermissions(
  {
    activityId,
    activityType,
    acceptedPermissionLevels,
  }: {
    activityId: string
    activityType: ActivityType
    acceptedPermissionLevels: DB.PermissionLevel[]
  },
  ctx: ContextWithUser
) {
  let valid = false
  let activity:
    | DB.LiveQuiz
    | DB.PracticeQuiz
    | DB.MicroLearning
    | DB.GroupActivity
    | null = null

  if (activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        ],
      },
    })

    if (liveQuiz) {
      valid = true
      activity = liveQuiz
    }
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        ],
      },
    })

    if (practiceQuiz) {
      valid = true
      activity = practiceQuiz
    }
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await ctx.prisma.microLearning.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        ],
      },
    })

    if (microLearning) {
      valid = true
      activity = microLearning
    }
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    const groupActivity = await ctx.prisma.groupActivity.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: { in: acceptedPermissionLevels },
              },
            },
          },
        ],
      },
    })

    if (groupActivity) {
      valid = true
      activity = groupActivity
    }
  }

  return { valid, activity }
}

// #endregion

// ! Template management functions
// #region

async function getActivityAnswerCollectionIds(
  {
    activityId,
    activityType,
  }: { activityId: string; activityType: ActivityType },
  ctx: ContextWithUser
): Promise<{
  error: boolean
  activity:
    | (DB.LiveQuiz & {
        blocks: (DB.ElementBlock & { elements: DB.ElementInstance[] })[]
      })
    | (DB.PracticeQuiz & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
      })
    | (DB.MicroLearning & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
      })
    | (DB.GroupActivity & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
        parameters: DB.GroupActivityParameter[]
        clues: DB.GroupActivityClue[]
      })
    | null
  noInstances: boolean
  answerCollectionIds: number[]
}> {
  // helper function that finds the ids of all answer collections linked to elements in an activity
  // fetch all element instances included in the activity that should be converted
  let instances: DB.ElementInstance[] = []
  let activity
  if (activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
              },
            },
          },
        ],
      },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!liveQuiz) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
      }
    }

    activity = liveQuiz
    instances = liveQuiz.blocks.flatMap((block) => block.elements)
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
              },
            },
          },
        ],
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!practiceQuiz) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
      }
    }

    activity = practiceQuiz
    instances = practiceQuiz.stacks.flatMap((stack) => stack.elements)
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await ctx.prisma.microLearning.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
              },
            },
          },
        ],
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!microLearning) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
      }
    }

    activity = microLearning
    instances = microLearning.stacks.flatMap((stack) => stack.elements)
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    const groupActivity = await ctx.prisma.groupActivity.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
              },
            },
          },
        ],
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
        parameters: true,
        clues: true,
      },
    })

    if (!groupActivity) {
      return {
        error: true,
        activity: null,
        noInstances: false,
        answerCollectionIds: [],
      }
    }

    activity = groupActivity
    instances = groupActivity.stacks.flatMap((stack) => stack.elements)
  } else {
    return {
      error: true,
      activity: null,
      noInstances: false,
      answerCollectionIds: [],
    }
  }

  // if no instances are found, return this
  if (instances.length === 0) {
    return {
      error: false,
      activity,
      noInstances: true,
      answerCollectionIds: [],
    }
  }

  // extract all answer collection ids (and potential other resources once supported)
  const answerCollectionIds = Array.from(
    new Set(
      instances
        .filter(
          (instance) =>
            instance.elementType === DB.ElementType.SELECTION ||
            instance.elementType === DB.ElementType.CASE_STUDY
        )
        .map((instance) =>
          instance.elementType === DB.ElementType.SELECTION
            ? (instance.elementData as SelectionElementData).options
                .answerCollection!.id
            : (instance.elementData as CaseStudyElementData).options
                .answerCollectionId!
        )
    )
  )

  return { error: false, activity, noInstances: false, answerCollectionIds }
}

export async function checkTemplateInfoAvailable(
  {
    activityId,
    activityType,
  }: { activityId: string; activityType: ActivityType },
  ctx: ContextWithUser
) {
  // fetch all answer collections linked to elements in the activity
  const { error, noInstances, answerCollectionIds } =
    (await getActivityAnswerCollectionIds({ activityId, activityType }, ctx)) ??
    {}

  if (error) {
    return null
  }

  // if no instances are found, return this
  if (noInstances) {
    return {
      noInstances: true,
      noResourcesRequired: false,
      resourcesRequiredExist: false,
      resourcesRequiredMissing: false,
    }
  }

  // if no resources are used in the instances, return this
  if (answerCollectionIds.length === 0) {
    return {
      noInstances: false,
      noResourcesRequired: true,
      resourcesRequiredExist: false,
      resourcesRequiredMissing: false,
    }
  }

  // check if all answer collections are available to the user
  const answerCollections = await ctx.prisma.answerCollection.findMany({
    where: {
      id: {
        in: answerCollectionIds,
      },
      OR: [
        {
          ownerId: ctx.user.sub,
        },
        {
          permissions: {
            some: {
              userId: ctx.user.sub,
              permissionStatus: DB.PermissionStatus.GRANTED,
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  })

  // check if all required answer collections exist
  if (answerCollections.length === answerCollectionIds.length) {
    return {
      noInstances: false,
      noResourcesRequired: false,
      resourcesRequiredExist: true,
      resourcesRequiredMissing: false,
    }
  } else {
    return {
      noInstances: false,
      noResourcesRequired: false,
      resourcesRequiredExist: false,
      resourcesRequiredMissing: true,
    }
  }
}

// TODO: once shared activity overview is available, return suitable activity type for more efficient query update (instead of refetch query)
export async function createActivityTemplate(
  {
    activityId,
    activityType,
    templateName,
    templateDescription,
    templateInstructions,
    copyBeforeConversion,
  }: {
    activityId: string
    activityType: ActivityType
    templateName: string
    templateDescription: string
    templateInstructions: string
    copyBeforeConversion: boolean
  },
  ctx: ContextWithUser
) {
  // fetch all answer collections linked to elements in the activity
  const { error, activity, noInstances, answerCollectionIds } =
    await getActivityAnswerCollectionIds({ activityId, activityType }, ctx)

  if (error || noInstances) {
    return false
  }

  if (copyBeforeConversion) {
    if (activityType === ActivityType.LIVE_QUIZ) {
      if (!activity) {
        return false
      }
      const liveQuiz = activity as DB.LiveQuiz & {
        blocks: (DB.ElementBlock & { elements: DB.ElementInstance[] })[]
      }

      const liveQuizTemplate = await ctx.prisma.liveQuiz.create({
        data: {
          name: templateName,
          displayName: liveQuiz.displayName,
          description: liveQuiz.description,
          status: DB.PublicationStatus.TEMPLATE,
          pointsMultiplier: liveQuiz.pointsMultiplier,
          defaultPoints: liveQuiz.defaultPoints,
          defaultCorrectPoints: liveQuiz.defaultCorrectPoints,
          maxBonusPoints: liveQuiz.maxBonusPoints,
          timeToZeroBonus: liveQuiz.timeToZeroBonus,
          isGamificationEnabled: liveQuiz.isGamificationEnabled,
          isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
          isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
          isModerationEnabled: liveQuiz.isModerationEnabled,
          // add blocks with elements
          blocks: {
            create: liveQuiz.blocks.map((block) => ({
              order: block.order,
              timeLimit: block.timeLimit,
              elements: {
                create: block.elements.map((element) => ({
                  elementType: element.elementType,
                  migrationId: uuidv4(),
                  order: element.order,
                  type: DB.ElementInstanceType.LIVE_QUIZ,
                  elementData: element.elementData,
                  options: element.options,
                  results: element.results,
                  anonymousResults: element.anonymousResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      DB.ElementInstanceType.LIVE_QUIZ
                    ),
                  },
                  element: {
                    connect: { id: element.elementId },
                  },
                  owner: {
                    connect: { id: ctx.user.sub },
                  },
                })),
              },
            })),
          },
          // add template information
          templateInfo: {
            create: {
              description: templateDescription,
              instructions: templateInstructions,
              answerCollections:
                answerCollectionIds.length > 0
                  ? {
                      connect: answerCollectionIds.map((id) => ({ id })),
                    }
                  : undefined,
            },
          },
          // creator of template becomes new owner of the template activity
          owner: {
            connect: {
              id: ctx.user.sub,
            },
          },
        },
      })

      return true
    } else if (activityType === ActivityType.PRACTICE_QUIZ) {
      if (!activity) {
        return false
      }
      const practiceQuiz = activity as DB.PracticeQuiz & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
      }

      const practiceQuizTemplate = await ctx.prisma.practiceQuiz.create({
        data: {
          name: templateName,
          displayName: practiceQuiz.displayName,
          description: practiceQuiz.description,
          status: DB.PublicationStatus.TEMPLATE,
          pointsMultiplier: practiceQuiz.pointsMultiplier,
          orderType: practiceQuiz.orderType,
          resetTimeDays: practiceQuiz.resetTimeDays,
          // add stacks with elements
          stacks: {
            create: practiceQuiz.stacks.map((stack) => ({
              type: DB.ElementStackType.PRACTICE_QUIZ,
              order: stack.order,
              displayName: stack.displayName,
              description: stack.description,
              elements: {
                create: stack.elements.map((element) => ({
                  elementType: element.elementType,
                  migrationId: uuidv4(),
                  order: element.order,
                  type: DB.ElementInstanceType.PRACTICE_QUIZ,
                  elementData: element.elementData,
                  options: element.options,
                  results: element.results,
                  anonymousResults: element.anonymousResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      DB.ElementInstanceType.PRACTICE_QUIZ
                    ),
                  },
                  element: {
                    connect: { id: element.elementId },
                  },
                  owner: {
                    connect: { id: ctx.user.sub },
                  },
                })),
              },
            })),
          },
          // add template information
          templateInfo: {
            create: {
              description: templateDescription,
              instructions: templateInstructions,
              answerCollections:
                answerCollectionIds.length > 0
                  ? {
                      connect: answerCollectionIds.map((id) => ({ id })),
                    }
                  : undefined,
            },
          },
          // templates from asynchronous activities are linked to the same course
          course: {
            connect: { id: practiceQuiz.courseId },
          },
          // creator of template becomes new owner of the template activity
          owner: { connect: { id: ctx.user.sub } },
        },
      })

      return true
    } else if (activityType === ActivityType.MICRO_LEARNING) {
      if (!activity) {
        return false
      }
      const microLearning = activity as DB.MicroLearning & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
      }

      const microLearningTemplate = await ctx.prisma.microLearning.create({
        data: {
          name: templateName,
          displayName: microLearning.displayName,
          description: microLearning.description,
          status: DB.PublicationStatus.TEMPLATE,
          pointsMultiplier: microLearning.pointsMultiplier,
          scheduledStartAt: microLearning.scheduledStartAt,
          scheduledEndAt: microLearning.scheduledEndAt,
          // add stacks with elements
          stacks: {
            create: microLearning.stacks.map((stack) => ({
              type: DB.ElementStackType.MICROLEARNING,
              order: stack.order,
              displayName: stack.displayName,
              description: stack.description,
              elements: {
                create: stack.elements.map((element) => ({
                  elementType: element.elementType,
                  migrationId: uuidv4(),
                  order: element.order,
                  type: DB.ElementInstanceType.MICROLEARNING,
                  elementData: element.elementData,
                  options: element.options,
                  results: element.results,
                  anonymousResults: element.anonymousResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      DB.ElementInstanceType.MICROLEARNING
                    ),
                  },
                  element: {
                    connect: { id: element.elementId },
                  },
                  owner: {
                    connect: { id: ctx.user.sub },
                  },
                })),
              },
            })),
          },
          // add template information
          templateInfo: {
            create: {
              description: templateDescription,
              instructions: templateInstructions,
              answerCollections:
                answerCollectionIds.length > 0
                  ? {
                      connect: answerCollectionIds.map((id) => ({ id })),
                    }
                  : undefined,
            },
          },
          // templates from asynchronous activities are linked to the same course
          course: {
            connect: { id: microLearning.courseId },
          },
          // creator of template becomes new owner of the template activity
          owner: { connect: { id: ctx.user.sub } },
        },
      })

      return true
    } else if (activityType === ActivityType.GROUP_ACTIVITY) {
      if (!activity) {
        return false
      }
      const groupActivity = activity as DB.GroupActivity & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
        parameters: DB.GroupActivityParameter[]
        clues: DB.GroupActivityClue[]
      }

      const groupActivityTemplate = await ctx.prisma.groupActivity.create({
        data: {
          name: templateName,
          displayName: groupActivity.displayName,
          description: groupActivity.description,
          status: DB.PublicationStatus.TEMPLATE,
          pointsMultiplier: groupActivity.pointsMultiplier,
          scheduledStartAt: groupActivity.scheduledStartAt,
          scheduledEndAt: groupActivity.scheduledEndAt,
          // copy parameters and clues
          parameters: {
            create: groupActivity.parameters,
          },
          clues: {
            create: groupActivity.clues,
          },
          // add stacks with elements
          stacks: {
            create: groupActivity.stacks.map((stack) => ({
              type: DB.ElementStackType.GROUP_ACTIVITY,
              order: stack.order,
              displayName: stack.displayName,
              description: stack.description,
              elements: {
                create: stack.elements.map((element) => ({
                  elementType: element.elementType,
                  migrationId: uuidv4(),
                  order: element.order,
                  type: DB.ElementInstanceType.GROUP_ACTIVITY,
                  elementData: element.elementData,
                  options: element.options,
                  results: element.results,
                  anonymousResults: element.anonymousResults,
                  instanceStatistics: {
                    create: getInitialInstanceStatistics(
                      DB.ElementInstanceType.GROUP_ACTIVITY
                    ),
                  },
                  element: {
                    connect: { id: element.elementId },
                  },
                  owner: {
                    connect: { id: ctx.user.sub },
                  },
                })),
              },
            })),
          },
          // add template information
          templateInfo: {
            create: {
              description: templateDescription,
              instructions: templateInstructions,
              answerCollections:
                answerCollectionIds.length > 0
                  ? {
                      connect: answerCollectionIds.map((id) => ({ id })),
                    }
                  : undefined,
            },
          },
          // templates from asynchronous activities are linked to the same course
          course: {
            connect: { id: groupActivity.courseId },
          },
          // creator of template becomes new owner of the template activity
          owner: { connect: { id: ctx.user.sub } },
        },
      })

      return true
    }
  } else {
    // create new template with the provided information and update activity status in a transaction
    const template = await ctx.prisma.$transaction(async (tx) => {
      const newTemplate = await tx.activityTemplate.create({
        data: {
          description: templateDescription,
          instructions: templateInstructions,

          // link to activity
          liveQuiz:
            activityType === ActivityType.LIVE_QUIZ
              ? { connect: { id: activityId } }
              : undefined,
          practiceQuiz:
            activityType === ActivityType.PRACTICE_QUIZ
              ? { connect: { id: activityId } }
              : undefined,
          microLearning:
            activityType === ActivityType.MICRO_LEARNING
              ? { connect: { id: activityId } }
              : undefined,
          groupActivity:
            activityType === ActivityType.GROUP_ACTIVITY
              ? { connect: { id: activityId } }
              : undefined,

          // connect template to required resources as well
          answerCollections:
            answerCollectionIds.length > 0
              ? {
                  connect: answerCollectionIds.map((id) => ({ id })),
                }
              : undefined,
        },
      })

      // update the activity status to indicate that it has been converted to a template
      if (activityType === ActivityType.LIVE_QUIZ) {
        await tx.liveQuiz.update({
          where: {
            id: activityId,
          },
          data: {
            name: templateName,
            status: DB.PublicationStatus.TEMPLATE,
          },
        })
      } else if (activityType === ActivityType.PRACTICE_QUIZ) {
        await tx.practiceQuiz.update({
          where: {
            id: activityId,
          },
          data: {
            name: templateName,
            status: DB.PublicationStatus.TEMPLATE,
          },
        })
      } else if (activityType === ActivityType.MICRO_LEARNING) {
        await tx.microLearning.update({
          where: {
            id: activityId,
          },
          data: {
            name: templateName,
            status: DB.PublicationStatus.TEMPLATE,
          },
        })
      } else if (activityType === ActivityType.GROUP_ACTIVITY) {
        await tx.groupActivity.update({
          where: {
            id: activityId,
          },
          data: {
            name: templateName,
            status: DB.PublicationStatus.TEMPLATE,
          },
        })
      }

      return newTemplate
    })

    return true
  }
}

export async function deleteActivityTemplate(
  {
    activityId,
    activityType,
  }: {
    activityId: string
    activityType: ActivityType
  },
  ctx: ContextWithUser
) {
  // validate that the user has sufficient permissions on the activity template
  const { valid } = await validateActivityPermissions(
    {
      activityId,
      activityType,
      acceptedPermissionLevels: [DB.PermissionLevel.ADMIN],
    },
    ctx
  )

  if (!valid) {
    return null
  }

  // delete the activity linked to the template (automatically deleting the template through cascading delete)
  if (activityType === ActivityType.LIVE_QUIZ) {
    const deletedLiveQuiz = await ctx.prisma.liveQuiz.delete({
      where: {
        id: activityId,
      },
    })

    return deletedLiveQuiz.id
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const deletedPracticeQuiz = await ctx.prisma.practiceQuiz.delete({
      where: {
        id: activityId,
      },
    })

    return deletedPracticeQuiz.id
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const deletedMicroLearning = await ctx.prisma.microLearning.delete({
      where: {
        id: activityId,
      },
    })

    return deletedMicroLearning.id
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    const deletedGroupActivity = await ctx.prisma.groupActivity.delete({
      where: {
        id: activityId,
      },
    })

    return deletedGroupActivity.id
  }

  return null
}

export async function getTemplateInformation(
  {
    activityId,
    activityType,
  }: {
    activityId: string
    activityType: ActivityType
  },
  ctx: ContextWithUser
) {
  if (activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: activityId,
        status: DB.PublicationStatus.TEMPLATE,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: {
                  in: [DB.PermissionLevel.WRITE, DB.PermissionLevel.ADMIN],
                },
              },
            },
          },
        ],
      },
      include: {
        templateInfo: true,
      },
    })

    return liveQuiz && liveQuiz.templateInfo
      ? {
          ...liveQuiz.templateInfo,
          templateId: liveQuiz.templateInfo.id,
          name: liveQuiz.name,
        }
      : null
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: {
                  in: [DB.PermissionLevel.WRITE, DB.PermissionLevel.ADMIN],
                },
              },
            },
          },
        ],
      },
      include: {
        templateInfo: true,
      },
    })

    return practiceQuiz && practiceQuiz.templateInfo
      ? {
          ...practiceQuiz.templateInfo,
          templateId: practiceQuiz.templateInfo.id,
          name: practiceQuiz.name,
        }
      : null
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await ctx.prisma.microLearning.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: {
                  in: [DB.PermissionLevel.WRITE, DB.PermissionLevel.ADMIN],
                },
              },
            },
          },
        ],
      },
      include: {
        templateInfo: true,
      },
    })

    return microLearning && microLearning.templateInfo
      ? {
          ...microLearning.templateInfo,
          templateId: microLearning.templateInfo.id,
          name: microLearning.name,
        }
      : null
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    const groupActivity = await ctx.prisma.groupActivity.findUnique({
      where: {
        id: activityId,
        OR: [
          {
            ownerId: ctx.user.sub,
          },
          {
            permissions: {
              some: {
                userId: ctx.user.sub,
                permissionStatus: DB.PermissionStatus.GRANTED,
                permissionLevel: {
                  in: [DB.PermissionLevel.WRITE, DB.PermissionLevel.ADMIN],
                },
              },
            },
          },
        ],
      },
      include: {
        templateInfo: true,
      },
    })

    return groupActivity && groupActivity.templateInfo
      ? {
          ...groupActivity.templateInfo,
          templateId: groupActivity.templateInfo.id,
          name: groupActivity.name,
        }
      : null
  }

  return null
}

export async function editActivityTemplate(
  {
    activityId,
    activityType,
    templateId,
    name,
    description,
    instructions,
  }: {
    activityId: string
    activityType: ActivityType
    templateId: string
    name: string
    description: string
    instructions: string
  },
  ctx: ContextWithUser
) {
  const { valid, activity } = await validateActivityPermissions(
    {
      activityId,
      activityType,
      acceptedPermissionLevels: [
        DB.PermissionLevel.ADMIN,
        DB.PermissionLevel.WRITE,
      ],
    },
    ctx
  )

  if (!valid) {
    return false
  }

  try {
    // update the metadata of the template and activity name in a transaction
    const newTemplate = await ctx.prisma.$transaction(async (tx) => {
      // update the template metadata
      const updatedTemplate = await tx.activityTemplate.update({
        where: {
          id: templateId,
          liveQuizId:
            activityType === ActivityType.LIVE_QUIZ ? activityId : undefined,
          practiceQuizId:
            activityType === ActivityType.PRACTICE_QUIZ
              ? activityId
              : undefined,
          microLearningId:
            activityType === ActivityType.MICRO_LEARNING
              ? activityId
              : undefined,
          groupActivityId:
            activityType === ActivityType.GROUP_ACTIVITY
              ? activityId
              : undefined,
        },
        data: {
          description,
          instructions,
        },
      })

      // update the name of the activity based on activityType
      if (activityType === ActivityType.LIVE_QUIZ) {
        await tx.liveQuiz.update({
          where: {
            id: activityId,
            status: DB.PublicationStatus.TEMPLATE,
          },
          data: {
            name,
          },
        })
      } else if (activityType === ActivityType.PRACTICE_QUIZ) {
        await tx.practiceQuiz.update({
          where: {
            id: activityId,
            status: DB.PublicationStatus.TEMPLATE,
          },
          data: {
            name,
          },
        })
      } else if (activityType === ActivityType.MICRO_LEARNING) {
        await tx.microLearning.update({
          where: {
            id: activityId,
            status: DB.PublicationStatus.TEMPLATE,
          },
          data: {
            name,
          },
        })
      } else if (activityType === ActivityType.GROUP_ACTIVITY) {
        await tx.groupActivity.update({
          where: {
            id: activityId,
            status: DB.PublicationStatus.TEMPLATE,
          },
          data: {
            name,
          },
        })
      }

      return updatedTemplate
    })

    // TODO: once activity overview has been unified (shared types), update the return type for efficient cache updates
    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

// #endregion
