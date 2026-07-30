import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  CaseStudyElementData,
  ElementOptionsInput,
  SelectionElementData,
  TemplateBlockInput,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  getInitialInstanceStatistics,
  MISSING_CATALOG_COLLECTION_ID,
  PrismaTransactionClient,
  processElementData,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { validate as uuidValidate } from 'uuid'
import { isTemplateElementTypeSupported } from '../lib/codeElementPolicy.js'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import { manipulateElement } from './elements.js'
import { getAnswerCollectionsElements } from './resources.js'
import { checkAccess } from './sharing.js'

// ! Helper functions
// #region
export async function validateTemplateAccessible(
  { templateId }: { templateId: string },
  ctx: PrismaTransactionContextWithUser
) {
  const template = await ctx.prisma.activityTemplate.findUnique({
    where: { id: templateId },
    include: {
      liveQuiz: {
        include: {
          permissions: { where: { userId: ctx.user.sub } },
          catalogAssignments: {
            include: {
              catalogCollection: {
                include: { permissions: { where: { userId: ctx.user.sub } } },
              },
            },
          },
        },
      },
      practiceQuiz: {
        include: {
          permissions: { where: { userId: ctx.user.sub } },
          catalogAssignments: {
            include: {
              catalogCollection: {
                include: { permissions: { where: { userId: ctx.user.sub } } },
              },
            },
          },
        },
      },
      microLearning: {
        include: {
          permissions: { where: { userId: ctx.user.sub } },
          catalogAssignments: {
            include: {
              catalogCollection: {
                include: { permissions: { where: { userId: ctx.user.sub } } },
              },
            },
          },
        },
      },
      groupActivity: {
        include: {
          permissions: { where: { userId: ctx.user.sub } },
          catalogAssignments: {
            include: {
              catalogCollection: {
                include: { permissions: { where: { userId: ctx.user.sub } } },
              },
            },
          },
        },
      },
      answerCollections: { select: { id: true } },
    },
  })

  // verify that at least one of the activities linked to the template is defined
  const activityMap = {
    [ActivityType.LIVE_QUIZ]: template?.liveQuiz ?? null,
    [ActivityType.PRACTICE_QUIZ]: template?.practiceQuiz ?? null,
    [ActivityType.MICRO_LEARNING]: template?.microLearning ?? null,
    [ActivityType.GROUP_ACTIVITY]: template?.groupActivity ?? null,
  }
  const [_, activity] = Object.entries(activityMap).find(
    ([_, value]) => value !== null
  ) || [null, null]

  // if no activity is connected, return false
  if (!activity) {
    return { accessible: false, template: null }
  }

  // if the user is the template activity owner, return true
  if (activity.ownerId === ctx.user.sub) {
    return { accessible: true, template }
  }

  // if the user has been granted access directly to the template activity, return true
  if (activity.permissions.length > 0) {
    return { accessible: true, template }
  }

  // if the activity template is included as a public item in a public catalog collection, it is accessible to everyone
  if (
    activity.catalogAssignments.some(
      (assignment) =>
        assignment.access === DB.ObjectAccess.PUBLIC &&
        (assignment.catalogCollectionId === MISSING_CATALOG_COLLECTION_ID ||
          assignment.catalogCollection.access === DB.ObjectAccess.PUBLIC)
    )
  ) {
    return { accessible: true, template }
  }

  // if the activity template is included as a public item in a restricted catalog collection, to which the user has access, it is accessible
  if (
    activity.catalogAssignments.some(
      (assignment) =>
        assignment.access === DB.ObjectAccess.PUBLIC &&
        assignment.catalogCollection.permissions.length > 0
    )
  ) {
    return { accessible: true, template }
  }

  return { accessible: false, template: null }
}

// #endregion

// ! Template management functions
// #region
export async function getActivityAnswerCollectionIds(
  {
    activityId,
    activityType,
  }: { activityId: string; activityType: ActivityType },
  prisma: PrismaTransactionClient
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
  answerCollectionEntryIds: number[]
}> {
  // helper function that finds the ids of all answer collections linked to elements in an activity
  // fetch all element instances included in the activity that should be converted
  let instances: DB.ElementInstance[] = []
  let activity
  if (activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: {
        id: activityId,
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
        answerCollectionEntryIds: [],
      }
    }

    activity = liveQuiz
    instances = liveQuiz.blocks.flatMap((block) => block.elements)
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
      where: {
        id: activityId,
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
        answerCollectionEntryIds: [],
      }
    }

    activity = practiceQuiz
    instances = practiceQuiz.stacks.flatMap((stack) => stack.elements)
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await prisma.microLearning.findUnique({
      where: {
        id: activityId,
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
        answerCollectionEntryIds: [],
      }
    }

    activity = microLearning
    instances = microLearning.stacks.flatMap((stack) => stack.elements)
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    const groupActivity = await prisma.groupActivity.findUnique({
      where: {
        id: activityId,
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
        answerCollectionEntryIds: [],
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
      answerCollectionEntryIds: [],
    }
  }

  // if no instances are found, return this
  if (instances.length === 0) {
    return {
      error: false,
      activity,
      noInstances: true,
      answerCollectionIds: [],
      answerCollectionEntryIds: [],
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

  // extract all answer collection entry ids that are used as sample solutions in selection elements or as items in case study elements
  const answerCollectionEntryIds = Array.from(
    new Set(
      instances
        .filter(
          (instance) =>
            instance.elementType === DB.ElementType.SELECTION ||
            instance.elementType === DB.ElementType.CASE_STUDY
        )
        .flatMap((instance) =>
          instance.elementType === DB.ElementType.SELECTION
            ? ((instance.elementData as SelectionElementData).options
                .answerCollectionSolutionIds ?? [])
            : ((
                instance.elementData as CaseStudyElementData
              ).options.items!.map((item) => item.id) ?? [])
        )
    )
  )

  return {
    error: false,
    activity,
    noInstances: false,
    answerCollectionIds,
    answerCollectionEntryIds,
  }
}

export async function checkTemplateInfoAvailable(
  {
    activityId,
    activityType,
  }: { activityId: string; activityType: ActivityType },
  ctx: ContextWithUser
) {
  // fetch all answer collections linked to elements in the activity
  const { error, noInstances, answerCollectionIds, answerCollectionEntryIds } =
    (await getActivityAnswerCollectionIds(
      { activityId, activityType },
      ctx.prisma
    )) ?? {}

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
    where: { id: { in: answerCollectionIds } },
    select: { id: true },
  })

  // check if all required answer collection entries are available to the user
  const answerCollectionEntries =
    await ctx.prisma.answerCollectionEntry.findMany({
      where: { id: { in: answerCollectionEntryIds } },
      select: { id: true },
    })

  // check if all required answer collections and answer collection entries exist
  if (
    answerCollections.length === answerCollectionIds.length &&
    answerCollectionEntries.length === answerCollectionEntryIds.length
  ) {
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
  const {
    error,
    activity,
    noInstances,
    answerCollectionIds,
    answerCollectionEntryIds,
  } = await getActivityAnswerCollectionIds(
    { activityId, activityType },
    ctx.prisma
  )

  if (error || noInstances || !activity) {
    return false
  }

  const activitySections =
    'blocks' in activity ? activity.blocks : activity.stacks
  if (
    activitySections.some((section) =>
      section.elements.some(
        (element) => !isTemplateElementTypeSupported(element.elementType)
      )
    )
  ) {
    return false
  }

  if (copyBeforeConversion) {
    if (activityType === ActivityType.LIVE_QUIZ) {
      const liveQuiz = activity as DB.LiveQuiz & {
        blocks: (DB.ElementBlock & { elements: DB.ElementInstance[] })[]
      }

      await ctx.prisma.$transaction(async (prisma) => {
        const template = await prisma.liveQuiz.create({
          data: {
            name: templateName,
            displayName: liveQuiz.displayName,
            description: liveQuiz.description,
            status: DB.PublicationStatus.TEMPLATE,
            pointsMultiplier: Math.max(liveQuiz.pointsMultiplier, 1),
            defaultPoints: Math.max(liveQuiz.defaultPoints, 0),
            defaultCorrectPoints: Math.max(liveQuiz.defaultCorrectPoints, 0),
            maxBonusPoints: Math.max(liveQuiz.maxBonusPoints, 0),
            timeToZeroBonus: Math.max(liveQuiz.timeToZeroBonus, 1),
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
                answerCollectionItems:
                  answerCollectionEntryIds.length > 0
                    ? {
                        connect: answerCollectionEntryIds.map((id) => ({ id })),
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

        await recomputeDerivedPermissions(
          {
            liveQuizId: template.id,
            userId: ctx.user.sub,
          },
          prisma
        )

        return template
      })

      return true
    } else if (activityType === ActivityType.PRACTICE_QUIZ) {
      const practiceQuiz = activity as DB.PracticeQuiz & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
      }

      await ctx.prisma.$transaction(async (prisma) => {
        const template = await prisma.practiceQuiz.create({
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
                answerCollectionItems:
                  answerCollectionEntryIds.length > 0
                    ? {
                        connect: answerCollectionEntryIds.map((id) => ({
                          id,
                        })),
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

        await recomputeDerivedPermissions(
          {
            practiceQuizId: template.id,
            userId: ctx.user.sub,
          },
          prisma
        )

        return template
      })

      return true
    } else if (activityType === ActivityType.MICRO_LEARNING) {
      const microLearning = activity as DB.MicroLearning & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
      }

      await ctx.prisma.$transaction(async (prisma) => {
        const template = await prisma.microLearning.create({
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
                answerCollectionItems:
                  answerCollectionEntryIds.length > 0
                    ? {
                        connect: answerCollectionEntryIds.map((id) => ({
                          id,
                        })),
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

        await recomputeDerivedPermissions(
          {
            microLearningId: template.id,
            userId: ctx.user.sub,
          },
          prisma
        )

        return template
      })

      return true
    } else if (activityType === ActivityType.GROUP_ACTIVITY) {
      const groupActivity = activity as DB.GroupActivity & {
        stacks: (DB.ElementStack & { elements: DB.ElementInstance[] })[]
        parameters: DB.GroupActivityParameter[]
        clues: DB.GroupActivityClue[]
      }

      await ctx.prisma.$transaction(async (prisma) => {
        const template = await prisma.groupActivity.create({
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
                answerCollectionItems:
                  answerCollectionEntryIds.length > 0
                    ? {
                        connect: answerCollectionEntryIds.map((id) => ({
                          id,
                        })),
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

        await recomputeDerivedPermissions(
          {
            groupActivityId: template.id,
            userId: ctx.user.sub,
          },
          prisma
        )

        return template
      })

      return true
    }
  } else {
    // create new template with the provided information and update activity status in a transaction
    await ctx.prisma.$transaction(async (tx) => {
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
          answerCollectionItems:
            answerCollectionEntryIds.length > 0
              ? {
                  connect: answerCollectionEntryIds.map((id) => ({ id })),
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
  // delete the activity linked to the template (automatically deleting the template through cascading delete)
  if (activityType === ActivityType.LIVE_QUIZ) {
    // fetch live quiz alongside all linked elements (for derived permissions update)
    const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id: activityId,
        status: DB.PublicationStatus.TEMPLATE,
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
      return null
    }

    const deletedId = await ctx.prisma.$transaction(
      async (prisma) => {
        const deletedLiveQuiz = await prisma.liveQuiz.delete({
          where: {
            id: activityId,
          },
        })

        // update derived permissions on all linked elements
        // access requests need to be updated as well, since the derived permissions on elements might have changed
        await propagateActivityToElements(
          { stacks: liveQuiz.blocks, updateAccessRequests: true },
          prisma
        )

        return deletedLiveQuiz.id
      },
      { timeout: 60000 }
    )

    return deletedId
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    // fetch practice quiz alongside all linked elements (for derived permissions update)
    const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
      where: {
        id: activityId,
        status: DB.PublicationStatus.TEMPLATE,
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
      return null
    }

    const deletedId = await ctx.prisma.$transaction(
      async (prisma) => {
        const deletedPracticeQuiz = await prisma.practiceQuiz.delete({
          where: {
            id: activityId,
          },
        })

        // update derived permissions on all linked elements
        // access requests need to be updated as well, since the derived permissions on elements might have changed
        await propagateActivityToElements(
          { stacks: practiceQuiz.stacks, updateAccessRequests: true },
          prisma
        )

        return deletedPracticeQuiz.id
      },
      { timeout: 60000 }
    )

    return deletedId
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    // fetch microlearning alongside all linked elements (for derived permissions update)
    const microLearning = await ctx.prisma.microLearning.findUnique({
      where: {
        id: activityId,
        status: DB.PublicationStatus.TEMPLATE,
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
      return null
    }

    const deletedId = await ctx.prisma.$transaction(
      async (prisma) => {
        const deletedMicroLearning = await prisma.microLearning.delete({
          where: {
            id: activityId,
          },
        })

        // update derived permissions on all linked elements
        // access requests need to be updated as well, since the derived permissions on elements might have changed
        await propagateActivityToElements(
          { stacks: microLearning.stacks, updateAccessRequests: true },
          prisma
        )

        return deletedMicroLearning.id
      },
      { timeout: 60000 }
    )

    return deletedId
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    // fetch group activity alongside all linked elements (for derived permissions update)
    const groupActivity = await ctx.prisma.groupActivity.findUnique({
      where: {
        id: activityId,
        status: DB.PublicationStatus.TEMPLATE,
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!groupActivity) {
      return null
    }

    const deletedId = await ctx.prisma.$transaction(
      async (prisma) => {
        const deletedGroupActivity = await prisma.groupActivity.delete({
          where: {
            id: activityId,
          },
        })

        // update derived permissions on all linked elements
        // access requests need to be updated as well, since the derived permissions on elements might have changed
        await propagateActivityToElements(
          { stacks: groupActivity.stacks, updateAccessRequests: true },
          prisma
        )

        return deletedGroupActivity.id
      },
      { timeout: 60000 }
    )

    return deletedId
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
        status: DB.PublicationStatus.TEMPLATE,
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
        status: DB.PublicationStatus.TEMPLATE,
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
        status: DB.PublicationStatus.TEMPLATE,
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
  try {
    // update the metadata of the template and activity name in a transaction
    await ctx.prisma.$transaction(async (tx) => {
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

export async function getActivityTemplate(
  { templateId }: { templateId: string },
  ctx: ContextWithUser
) {
  // verify that the user has access to the template activity
  const { accessible } = await validateTemplateAccessible({ templateId }, ctx)
  if (!accessible) {
    return null
  }

  // fetch the template alongside the corresponding activities and elements
  const template = await ctx.prisma.activityTemplate.findUnique({
    where: {
      id: templateId,
    },
    include: {
      liveQuiz: {
        where: {
          isDeleted: false,
        },
        include: {
          blocks: {
            include: {
              elements: {
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      practiceQuiz: {
        where: {
          isDeleted: false,
        },
        include: {
          stacks: {
            include: {
              elements: {
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      microLearning: {
        where: {
          isDeleted: false,
        },
        include: {
          stacks: {
            include: {
              elements: {
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      groupActivity: {
        where: {
          isDeleted: false,
        },
        include: {
          stacks: {
            include: {
              elements: {
                orderBy: {
                  order: 'asc',
                },
              },
            },
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      answerCollections: true,
    },
  })

  let activityType: ActivityType | null = null
  if (template?.liveQuiz) {
    activityType = ActivityType.LIVE_QUIZ
  } else if (template?.practiceQuiz) {
    activityType = ActivityType.PRACTICE_QUIZ
  } else if (template?.microLearning) {
    activityType = ActivityType.MICRO_LEARNING
  } else if (template?.groupActivity) {
    activityType = ActivityType.GROUP_ACTIVITY
  }

  // if the template is not defined or no activity is linked to the template, return null
  if (!template || activityType === null) {
    return null
  }

  return { ...template, activityType }
}

export async function getMatchingUserElementsTemplate(
  {
    elementType,
    hasSampleSolution,
    hasAnswerFeedbacks,
  }: {
    elementType: DB.ElementType
    hasSampleSolution?: boolean | null
    hasAnswerFeedbacks?: boolean | null
  },
  ctx: ContextWithUser
) {
  const elementTypesWithSampleSolution: DB.ElementType[] = [
    DB.ElementType.SC,
    DB.ElementType.MC,
    DB.ElementType.KPRIM,
    DB.ElementType.NUMERICAL,
    DB.ElementType.FREE_TEXT,
    DB.ElementType.SELECTION,
    DB.ElementType.CASE_STUDY,
  ]
  const elementTypesWithAnswerFeedbacks: DB.ElementType[] = [
    DB.ElementType.SC,
    DB.ElementType.MC,
    DB.ElementType.KPRIM,
  ]

  const availableElements = await ctx.prisma.element.findMany({
    where: {
      type: elementType,
      isDeleted: false,
      permissions: {
        some: {
          userId: ctx.user.sub,
        },
      },
    },
    select: {
      id: true,
      name: true,
      content: true,
      options: true,
    },
  })

  // filter out elements that do not match the sample solution or answer feedback requirements
  const matchingElements = availableElements.filter((element) => {
    let valid = true

    if (
      hasSampleSolution !== null &&
      typeof hasSampleSolution !== 'undefined' &&
      elementTypesWithSampleSolution.includes(elementType)
    ) {
      valid =
        valid &&
        'hasSampleSolution' in element.options &&
        element.options.hasSampleSolution === hasSampleSolution
    }

    if (
      hasAnswerFeedbacks !== null &&
      typeof hasAnswerFeedbacks !== 'undefined' &&
      elementTypesWithAnswerFeedbacks.includes(elementType)
    ) {
      valid =
        valid &&
        'hasAnswerFeedbacks' in element.options &&
        element.options.hasAnswerFeedbacks === hasAnswerFeedbacks
    }

    return valid
  })

  return matchingElements
}

export async function checkTemplateElementExists(
  { name }: { name: string },
  ctx: ContextWithUser
) {
  // check if an element with the name already exists in the user's library
  const element = await ctx.prisma.element.findFirst({
    where: { name, permissions: { some: { userId: ctx.user.sub } } },
  })

  return element !== null
}

export async function getTemplatePreviewAnswerCollectionEntries(
  { templateId, answerCollectionId },
  ctx: ContextWithUser
) {
  const collections = await getAnswerCollectionsElements({ templateId }, ctx)
  const answerCollection = collections.find(
    (collection) => collection.id === answerCollectionId
  )

  if (!answerCollection) {
    return []
  }

  return answerCollection.entries.map((entry) => ({
    id: entry.id,
    value: entry.value,
  }))
}

export async function createLiveQuizFromTemplate(
  {
    templateId,
    name,
    displayName,
    description,
    blocks,
    courseId,
    isGamificationEnabled,
  }: {
    templateId: string
    // modified settings - shown in the UI
    name: string
    displayName: string
    description?: string | null
    courseId?: string | null
    isGamificationEnabled: boolean
    // block input - potentially including element data
    blocks: TemplateBlockInput[]
  },
  ctx: ContextWithUser
): Promise<string | null> {
  const { accessible, template } = await validateTemplateAccessible(
    { templateId },
    ctx
  )

  if (!accessible || !template || !template.liveQuizId) {
    return null
  }

  if (
    blocks.some((block) =>
      block.elements.some(
        (element) =>
          element.newElement &&
          !isTemplateElementTypeSupported(element.newElement.type)
      )
    )
  ) {
    return null
  }

  // get the available answer collection ids for the activity linked to the template
  const availableAnswerCollections = template.answerCollections.map(
    (collection) => collection.id
  )

  // fetch live quiz for blocked settings to be transferrable
  const templateLiveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: template.liveQuizId,
      status: DB.PublicationStatus.TEMPLATE,
    },
  })

  if (!templateLiveQuiz) {
    return null
  }

  const existingElementIds = blocks.flatMap((block) =>
    block.elements.flatMap((element) =>
      element.useExistingElement && element.existingElementId
        ? [element.existingElementId]
        : []
    )
  )
  const [unsupportedExistingElement, unsupportedTemplateInstance] =
    await Promise.all([
      existingElementIds.length > 0
        ? ctx.prisma.element.findFirst({
            where: {
              id: { in: existingElementIds },
              type: DB.ElementType.CODE,
              permissions: { some: { userId: ctx.user.sub } },
            },
            select: { id: true },
          })
        : null,
      ctx.prisma.elementInstance.findFirst({
        where: {
          elementBlock: { liveQuizId: template.liveQuizId },
          elementType: DB.ElementType.CODE,
        },
        select: { id: true },
      }),
    ])

  if (unsupportedExistingElement || unsupportedTemplateInstance) {
    return null
  }

  // check if the calling user has sufficient permissions on the course and the course exists
  const cleanCourseId =
    typeof courseId === 'string' && courseId !== null && uuidValidate(courseId)
      ? courseId
      : undefined
  const course = cleanCourseId
    ? await ctx.prisma.course.findUnique({
        where: {
          id: cleanCourseId,
          permissions: { some: { userId: ctx.user.sub } },
        },
      })
    : null

  // if the course should exist, but doesn't, return early
  if (cleanCourseId && !course) {
    return null
  }

  // activities in gamified courses should always be gamified, otherwise respect user setting
  const gamificationSetting = course?.isGamificationEnabled
    ? course.isGamificationEnabled
    : isGamificationEnabled

  // only activities in assessment courses will be marked as being part of assessment
  const assessmentSetting = course?.isAssessmentEnabled ?? false

  // inside a prisma transaction, create all required elements, permissions and the activity
  const newLiveQuiz = await ctx.prisma.$transaction(
    async (prisma) => {
      const liveQuizContent: {
        blocks: {
          order: number
          timeLimit?: number | null
          elements: {
            order: number
            element: DB.Element
          }[]
        }[]
      } = { blocks: [] }

      // iterate over all blocks and either fetch the existing element from the database or create a new one
      for (const block of blocks) {
        const elements: {
          order: number
          element: DB.Element & {
            answerCollection?:
              | (DB.AnswerCollection & { entries: DB.AnswerCollectionEntry[] })
              | null
            answerCollectionItems?: DB.AnswerCollectionEntry[] | null
          }
        }[] = []
        for (const element of block.elements) {
          if (element.useExistingElement) {
            if (
              element.existingElementId === null ||
              typeof element.existingElementId === 'undefined'
            ) {
              throw new Error('Existing element id not provided')
            }

            // find existing element in user account
            const existingElement = await prisma.element.findUnique({
              where: {
                id: element.existingElementId,
                permissions: {
                  some: {
                    userId: ctx.user.sub,
                  },
                },
              },
              include: {
                answerCollection: {
                  include: {
                    entries: true,
                  },
                },
                answerCollectionItems: true,
              },
            })

            if (!existingElement) {
              console.log(
                'Failed to find element with id',
                element.existingElementId
              )
              throw new Error(
                'Existing element does not exist or user does not have access to it'
              )
            }

            // add existing element to content map
            elements.push({
              order: element.order,
              element: existingElement,
            })
          } else if (element.useNewElement) {
            if (
              element.newElement === null ||
              typeof element.newElement === 'undefined'
            ) {
              throw new Error('New element data not provided')
            }

            // set the options element options value depending on the element type
            const values = element.newElement
            if (
              values.type === DB.ElementType.SC ||
              values.type === DB.ElementType.MC ||
              values.type === DB.ElementType.KPRIM
            ) {
              if (!('choicesOptions' in values)) {
                throw new Error(
                  'Choices options not provided for Choices element'
                )
              }

              values.options = values.choicesOptions
            } else if (values.type === DB.ElementType.NUMERICAL) {
              if (!('numericalOptions' in values)) {
                throw new Error(
                  'Numerical options not provided for Numerical element'
                )
              }

              values.options = values.numericalOptions
            } else if (values.type === DB.ElementType.FREE_TEXT) {
              if (!('freeTextOptions' in values)) {
                throw new Error(
                  'Free text options not provided for Free Text element'
                )
              }

              values.options = values.freeTextOptions
            } else if (values.type === DB.ElementType.SELECTION) {
              if (!('selectionOptions' in values)) {
                throw new Error(
                  'Selection options not provided for Selection element'
                )
              }

              values.options = values.selectionOptions
            } else if (values.type === DB.ElementType.CASE_STUDY) {
              if (!('caseStudyOptions' in values)) {
                throw new Error(
                  'Case study options not provided for Case Study element'
                )
              }

              values.options = values.caseStudyOptions
            }

            // check if the user has access to potential answer collections linked to the new element or if they are contained in the template
            if (
              values.type === DB.ElementType.SELECTION ||
              values.type === DB.ElementType.CASE_STUDY
            ) {
              if (
                !('options' in values) ||
                !values.options ||
                !('answerCollection' in values.options) ||
                typeof values.options?.answerCollection === 'undefined' ||
                values.options.answerCollection === null
              ) {
                throw new Error(
                  'Answer collection not provided for selection or case study element'
                )
              }

              // get answer collection id that should be linked to the new element
              const answerCollectionId = values.options.answerCollection

              // check if the user already has access to the answer collection
              const valid = await checkAccess(
                [
                  {
                    answerCollectionId: answerCollectionId,
                    minimumPermissionLevel: DB.PermissionLevel.READ,
                  },
                ],
                { ...ctx, prisma }
              )

              if (!valid) {
                // if access does not already exist, check if the answer collection is linked to the template
                if (!availableAnswerCollections.includes(answerCollectionId)) {
                  throw new Error(
                    'User does not have access to the answer collection linked to the template'
                  )
                }

                // otherwise, grant new direct READ permission for the user on the answer collection
                await prisma.permission.upsert({
                  where: {
                    answerCollectionId_userId: {
                      answerCollectionId,
                      userId: ctx.user.sub,
                    },
                  },
                  create: {
                    permissionLevel: DB.PermissionLevel.READ,
                    user: {
                      connect: { id: ctx.user.sub },
                    },
                    answerCollection: {
                      connect: { id: answerCollectionId },
                    },
                  },
                  update: {},
                })
              }
            }

            // combine the element options depending on the element type
            let options: ElementOptionsInput | undefined | null = undefined
            if (
              values.type === DB.ElementType.SC ||
              values.type === DB.ElementType.MC ||
              values.type === DB.ElementType.KPRIM
            ) {
              options = values.choicesOptions
            } else if (values.type === DB.ElementType.NUMERICAL) {
              options = values.numericalOptions
            } else if (values.type === DB.ElementType.FREE_TEXT) {
              options = values.freeTextOptions
            } else if (values.type === DB.ElementType.SELECTION) {
              options = values.selectionOptions
            } else if (values.type === DB.ElementType.CASE_STUDY) {
              options = values.caseStudyOptions
            }

            // create a new element based on the provided data
            const createdElement = await manipulateElement(
              { ...values, options, templateId },
              { ...ctx, prisma }
            )

            // throw an error if the element could not be created
            if (!createdElement) {
              console.log(
                'Failed to create new element from form inputs',
                values
              )
              throw new Error('Failed to create new element')
            }

            // TODO: make this a bit more efficient by not fetching the just created element again
            // re-fetch the created element including the answer collection and corresponding entries
            const newElement = await prisma.element.findUnique({
              where: {
                id: createdElement.id,
                ownerId: ctx.user.sub,
              },
              include: {
                answerCollection: {
                  include: {
                    entries: true,
                  },
                },
                answerCollectionItems: true,
              },
            })

            if (!newElement) {
              console.log('Failed to fetch newly created element')
              throw new Error('Failed to fetch newly created element')
            }

            elements.push({
              order: element.order,
              element: newElement,
            })
          } else {
            // no option was selected for one of the elements -> invalid input
            throw new Error('Invalid template element modification choice')
          }
        }

        liveQuizContent.blocks.push({
          order: block.order,
          timeLimit: block.timeLimit,
          elements,
        })
      }

      const quiz = await prisma.liveQuiz.create({
        data: {
          name: name.trim(),
          displayName: displayName.trim(),
          description,
          templateName: templateLiveQuiz.name,
          pointsMultiplier: Math.max(templateLiveQuiz.pointsMultiplier, 1),
          defaultPoints: Math.max(templateLiveQuiz.defaultPoints, 0),
          defaultCorrectPoints: Math.max(
            templateLiveQuiz.defaultCorrectPoints,
            0
          ),
          maxBonusPoints: Math.max(templateLiveQuiz.maxBonusPoints, 0),
          timeToZeroBonus: Math.max(templateLiveQuiz.timeToZeroBonus, 1),
          isGamificationEnabled: gamificationSetting,
          isAssessmentEnabled: assessmentSetting,
          isConfusionFeedbackEnabled:
            templateLiveQuiz.isConfusionFeedbackEnabled,
          isLiveQAEnabled: templateLiveQuiz.isLiveQAEnabled,
          isModerationEnabled: templateLiveQuiz.isModerationEnabled,
          blocks: {
            create: liveQuizContent.blocks.map((block) => ({
              order: block.order,
              timeLimit: block.timeLimit,
              elements: {
                create: block.elements.map((entry) => {
                  const elementData = processElementData(entry.element)
                  const initialResults = getInitialInstanceResults(elementData)

                  return {
                    elementType: entry.element.type,
                    order: entry.order,
                    type: DB.ElementInstanceType.LIVE_QUIZ,
                    elementData,
                    options: {
                      basePoints: entry.element.basePoints,
                      pointsMultiplier:
                        templateLiveQuiz.pointsMultiplier *
                        entry.element.pointsMultiplier,
                    },
                    results: initialResults,
                    anonymousResults: initialResults,
                    instanceStatistics: {
                      create: getInitialInstanceStatistics(
                        DB.ElementInstanceType.LIVE_QUIZ
                      ),
                    },
                    element: { connect: { id: entry.element.id } },
                    owner: { connect: { id: ctx.user.sub } },
                  }
                }),
              },
            })),
          },
          owner: { connect: { id: ctx.user.sub } },
          course: course ? { connect: { id: course.id } } : undefined,
        },
      })

      // trigger recomputation of the derived permissions for the new activity
      await recomputeDerivedPermissions(
        { liveQuizId: quiz.id, userId: ctx.user.sub },
        prisma
      )

      return quiz
    },
    { timeout: 60000 }
  )

  return newLiveQuiz.id
}

// #endregion
