import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
} from '@klicker-uzh/grading'
import {
  AccessMode,
  ConfusionTimestep,
  type Element,
  ElementBlock,
  ElementBlockStatus,
  ElementInstance,
  ElementInstanceType,
  ElementType,
  LeaderboardType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import type {
  CaseStudyCaseSolution,
  ElementBlockInput,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsContent,
  ElementResultsFlashcard,
  ElementResultsOpen,
  ElementResultsSelection,
  ElementStackInput,
} from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  getInitialInstanceResults,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { levelFromXp } from '@klicker-uzh/util/dist/pure.js'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { min } from 'mathjs'
import schedule from 'node-schedule'
import { createHmac } from 'node:crypto'
import { omitBy, pick, prop, sortBy } from 'remeda'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { sendTeamsNotifications } from '../lib/util.js'
import { upsertDailyTimelineEntry } from './participants.js'
import { computeStackEvaluation } from './stacks.js'

// TODO: rework scheduling for serverless
const scheduledJobs: Record<string, any> = {}

const FIRST_ACHIEVEMENT_ID = 5
const SECOND_ACHIEVEMENT_ID = 6
const THIRD_ACHIEVEMENT_ID = 7

// ------ HELPER FUNCTIONS ------
// #region
async function getCachedBlockResults({
  ctx,
  activeBlock,
}: {
  ctx: Context
  activeBlock: ElementBlock & { elements: ElementInstance[] }
}) {
  const redisMulti = ctx.redisExec.multi()

  redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:lb`)
  redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:b:${activeBlock.id}:lb`)

  const cacheData = await redisMulti.exec()

  if (!cacheData) {
    return null
  }

  const mappedResults: any[] = cacheData.map(([_, result]) => result)

  const liveQuizLeaderboard: Record<string, string> = mappedResults[0]
  const blockLeaderboard: Record<string, string> = mappedResults[1]

  const instanceResults: Record<
    string,
    {
      info: Record<string, string>
      responseHashes: Record<string, string>
      responses: Record<string, string>
      anonymousResults:
        | ElementResultsChoices
        | ElementResultsOpen
        | ElementResultsFlashcard
        | ElementResultsContent
        | ElementResultsSelection
    }
  > = {}

  for (const instance of activeBlock.elements) {
    const redisMulti = ctx.redisExec.multi()

    redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:i:${instance.id}:info`)
    redisMulti.hgetall(
      `lq:${activeBlock.liveQuizId}:i:${instance.id}:responseHashes`
    )
    redisMulti.hgetall(
      `lq:${activeBlock.liveQuizId}:i:${instance.id}:responses`
    )
    redisMulti.hgetall(`lq:${activeBlock.liveQuizId}:i:${instance.id}:results`)

    const cacheData = await redisMulti.exec()

    if (!cacheData) return

    const mappedResults: any[] = cacheData.map(([_, result]) => result)

    const [info, responseHashes, responses, results] = mappedResults

    // TODO: if possible, split up results and anonymous results here (potentially the cache content needs to augmented)
    let anonymousResults:
      | ElementResultsChoices
      | ElementResultsOpen
      | ElementResultsFlashcard
      | ElementResultsContent
      | ElementResultsSelection
      | undefined

    if (
      instance.elementType === ElementType.SC ||
      instance.elementType === ElementType.MC ||
      instance.elementType === ElementType.KPRIM
    ) {
      const choices = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsChoices['choices']>(
        (acc, [responseHash, count]) => {
          return {
            ...acc,
            [responseHash]: (acc[responseHash] ?? 0) + parseInt(count),
          }
        },
        {}
      )

      anonymousResults = {
        choices,
        total: parseInt(results.participants),
      } as ElementResultsChoices
    } else if (
      instance.elementType === ElementType.NUMERICAL ||
      instance.elementType === ElementType.FREE_TEXT
    ) {
      const responses = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsOpen['responses']>(
        (responses_acc, [responseHash, count]) => {
          let solutions = []
          try {
            solutions =
              'hasSampleSolution' in instance.elementData.options &&
              instance.elementData.options.hasSampleSolution
                ? JSON.parse(info.solutions)
                : []
          } catch (e) {
            console.log(
              'An error occured while parsing the solutions array from the cache:'
            )
            console.error(e)
          }

          const response = responseHashes[responseHash] ?? responseHash
          let grading: number | undefined
          if (solutions && solutions.length > 0) {
            if (instance.elementType === ElementType.NUMERICAL) {
              const exactSolutionsDefined =
                typeof solutions[0] === 'number' ||
                typeof solutions[0] === 'string'
              grading =
                gradeQuestionNumerical({
                  response,
                  solutionRanges: exactSolutionsDefined ? undefined : solutions,
                  exactSolutions: exactSolutionsDefined ? solutions : undefined,
                }) ?? undefined
            } else if (instance.elementType === ElementType.FREE_TEXT) {
              grading =
                gradeQuestionFreeText({
                  response,
                  solutions,
                }) ?? undefined
            }
          }

          const updatedResponse = {
            value: responseHashes[responseHash] ?? responseHash,
            count: (responses_acc[responseHash]?.count ?? 0) + parseInt(count),
          }

          return {
            ...responses_acc,
            [responseHash]:
              typeof grading !== 'undefined'
                ? {
                    ...updatedResponse,
                    correct: grading === 1 ? true : false,
                  }
                : updatedResponse,
          }
        },
        {}
      )

      anonymousResults = {
        responses,
        total: parseInt(results.participants),
      } as ElementResultsOpen
    } else if (instance.elementType === ElementType.SELECTION) {
      const selections = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<Record<string, number>>(
        (acc, [answerId, count]) => {
          acc[answerId] = (acc[answerId] ?? 0) + parseInt(count)
          return acc
        },
        { ...(instance.anonymousResults as ElementResultsSelection).selections }
      )

      anonymousResults = {
        selections,
        total: parseInt(results.participants),
      } as ElementResultsSelection
    } else if (instance.elementType === ElementType.CASE_STUDY) {
      const assessments = Object.entries(
        omitBy(results, (_, key) => key === 'participants')
      ).reduce<ElementResultsCaseStudy['assessments']>(
        (assessmentsAcc, [combinedHash, answerCount]) => {
          let solutions: {
            caseId: string
            itemSolutions: CaseStudyCaseSolution[]
          }[] = []
          try {
            solutions =
              'hasSampleSolution' in instance.elementData.options &&
              instance.elementData.options.hasSampleSolution
                ? JSON.parse(info.solutions)
                : []
          } catch (e) {
            console.log(
              'An error occured while parsing the solutions array from the cache:'
            )
            console.error(e)
          }

          const responseValue: number | undefined =
            responseHashes[combinedHash] ?? undefined

          if (responseValue === null || typeof responseValue === 'undefined') {
            console.log('An error occured while parsing the response value:')
            console.error('responseValue: ', responseValue)
            return assessmentsAcc
          }

          // split up combined hash into caseId, itemId, criterionId and responseHash
          const [caseId, itemId, criterionId, responseHash] =
            combinedHash.split(':')

          // if any of the ids or the hash are invalid, skip this response
          if (
            !caseId ||
            !itemId ||
            !criterionId ||
            !responseHash ||
            !responseValue
          ) {
            console.log('An error occured while parsing the combinedHash:')
            console.error('combinedHash: ', combinedHash)
            return assessmentsAcc
          }

          // verify that the corresponding case-item-criterion combination exists in the results
          if (
            typeof assessmentsAcc[caseId]?.[itemId]?.[criterionId] ===
            'undefined'
          ) {
            console.log(
              'An error occured while verifying the case-item-criterion combination:'
            )
            console.error('caseId', caseId)
            console.error('itemId', itemId)
            console.error('criterionId', criterionId)
            return assessmentsAcc
          }

          // TODO: the grading process could potentially be sped up by iterating over the solutions array
          // only once and selecting all corresponding responses based on the combinedHash
          let grading: number | undefined
          if (solutions && solutions.length > 0) {
            const caseSolutions = solutions.find(
              (solution) => solution.caseId === caseId
            )
            if (caseSolutions) {
              const itemSolution = caseSolutions.itemSolutions.find(
                (itemSolution) => itemSolution.itemId === parseInt(itemId)
              )
              if (itemSolution) {
                const criterionSolution = itemSolution.criteriaSolutions.find(
                  (criterionSolution) =>
                    criterionSolution.criterionId === criterionId
                )
                if (criterionSolution) {
                  grading =
                    responseValue >= criterionSolution.min &&
                    responseValue <= criterionSolution.max
                      ? 1
                      : 0
                }
              }
            }
          }

          assessmentsAcc[caseId][itemId][criterionId] = {
            ...assessmentsAcc[caseId][itemId][criterionId],
            [responseHash]: {
              value: responseValue,
              count: parseInt(answerCount),
              correct:
                typeof grading !== 'undefined'
                  ? grading === 1
                    ? true
                    : false
                  : undefined,
            },
          }

          return assessmentsAcc
        },
        {
          ...(instance.anonymousResults as ElementResultsCaseStudy).assessments,
        }
      )

      anonymousResults = {
        assessments,
        total: parseInt(results.participants),
      } as ElementResultsCaseStudy
    } else if (instance.elementType === ElementType.CONTENT) {
      anonymousResults = {
        total: parseInt(results.participants),
      } as ElementResultsChoices
    }

    instanceResults[instance.id] = {
      info,
      responseHashes,
      responses,
      anonymousResults: anonymousResults ?? { total: 0 },
    }
  }

  return {
    liveQuizLeaderboard,
    blockLeaderboard,
    instanceResults,
    activeInstanceIds: activeBlock.elements.map((instance) => instance.id),
  }
}

async function unlinkCachedBlockResults({
  ctx,
  quizId,
  blockId,
  activeInstanceIds,
}: {
  ctx: Context
  quizId: string
  blockId: number
  activeInstanceIds: number[]
}) {
  // unlink everything regarding the block in redis
  const unlinkMulti = ctx.redisExec.pipeline()
  unlinkMulti.unlink(`lq:${quizId}:b:${blockId}:lb`)
  activeInstanceIds.forEach((instanceId) => {
    unlinkMulti.unlink(`lq:${quizId}:i:${instanceId}:info`)
    unlinkMulti.unlink(`lq:${quizId}:i:${instanceId}:responseHashes`)
    unlinkMulti.unlink(`lq:${quizId}:i:${instanceId}:responses`)
    unlinkMulti.unlink(`lq:${quizId}:i:${instanceId}:results`)
  })
  return unlinkMulti.exec()
}
// #endregion

// ------ LIVE QUIZ CREATION / EDITING ------
// #region
export async function splitActivityInstances(
  {
    stacksOrBlocks,
  }: { stacksOrBlocks: ElementStackInput[] | ElementBlockInput[] },
  ctx: ContextWithUser
) {
  // in EDIT mode - compute map between id of instance that is kept and the new order attribute
  const persistentInstanceOrderMap = stacksOrBlocks.reduce<
    Record<number, number>
  >((acc, block) => {
    block.elements
      .filter(
        (element) =>
          element.existingInstanceId !== null && !element.duplicateInstance
      )
      .forEach((element) => {
        acc[element.existingInstanceId!] = element.order
      })
    return acc
  }, {})

  // extract the ids of all instances that should be kept in the activity
  const persistentInstanceIds = Object.keys(persistentInstanceOrderMap).map(
    (id) => parseInt(id)
  )

  // fetch instances that should be kept in the activity
  const persistentInstances = await ctx.prisma.elementInstance.findMany({
    where: {
      id: { in: persistentInstanceIds },
      owner: { id: ctx.user.sub },
    },
  })

  // in DUPLICATION mode - instances that should be duplicated in the activity
  const duplicateInstanceIds = stacksOrBlocks.flatMap(
    (stackOrBlock: ElementStackInput | ElementBlockInput) =>
      stackOrBlock.elements
        .filter(
          (element) =>
            element.existingInstanceId !== null && element.duplicateInstance
        )
        .map((element) => element.existingInstanceId!)
  )

  // fetch instances that should be duplicated into new quiz
  const duplicationInstances = await ctx.prisma.elementInstance.findMany({
    where: {
      id: { in: duplicateInstanceIds },
      owner: { id: ctx.user.sub },
    },
  })

  // get the ids of all elements that should be used for instance creation
  const requiredElementsIds = stacksOrBlocks
    .flatMap((block: ElementStackInput | ElementBlockInput) => block.elements)
    .filter((element) => element.existingInstanceId === null)
    .map((blockElem) => blockElem.elementId)

  // fetch all elements from the database that should be used for instance creation
  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: requiredElementsIds },
      isDeleted: false,
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

  // make sure that every element could be found and create a map for efficient access
  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }
  const elementMap = dbElements.reduce<Record<number, Element>>((acc, elem) => {
    acc[elem.id] = elem
    return acc
  }, {})

  return {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
  }
}

interface ManipulateLiveQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  blocks: ElementBlockInput[]
  courseId?: string | null
  multiplier: number
  defaultPoints?: number | null
  defaultCorrectPoints?: number | null
  maxBonusPoints?: number | null
  timeToZeroBonus?: number | null
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
}

export async function manipulateLiveQuiz(
  {
    id,
    name,
    displayName,
    description,
    blocks,
    courseId,
    multiplier,
    defaultPoints,
    defaultCorrectPoints,
    maxBonusPoints,
    timeToZeroBonus,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
  }: ManipulateLiveQuizArgs,
  ctx: ContextWithUser
) {
  // in EDIT mode - validate that the live quiz exists and is not published
  if (id) {
    const existingActivity = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
        isDeleted: false,
      },
    })

    if (!existingActivity) {
      throw new GraphQLError('Live quiz not found')
    }
    if (existingActivity.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published live quiz')
    }
  }

  // get required splits of instances based on provided blocks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
  } = await splitActivityInstances({ stacksOrBlocks: blocks }, ctx)

  // in EDIT mode - check which instances and blocks should be removed
  let instancesToDelete: number[] = []
  let blocksToDelete: number[] = []
  if (id) {
    const instances = await ctx.prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementBlock: {
          liveQuizId: id,
        },
      },
    })

    const blocks = await ctx.prisma.elementBlock.findMany({
      where: {
        liveQuizId: id,
      },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    blocksToDelete = blocks.map((block) => block.id)
  }

  // re-create blocks and link existing instance / create new instances (depending on mode and novelty of the included element)
  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    defaultPoints: defaultPoints ?? undefined,
    defaultCorrectPoints: defaultCorrectPoints ?? undefined,
    maxBonusPoints: maxBonusPoints ?? undefined,
    timeToZeroBonus: timeToZeroBonus ?? undefined,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
    blocks: {
      create: blocks.map((block) => ({
        order: block.order,
        timeLimit: block.timeLimit,
        elements: {
          connectOrCreate: block.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: ElementInstanceType.LIVE_QUIZ,
              activityMultiplier: multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
            })
          ),
        },
      })),
    },
    owner: {
      connect: { id: ctx.user.sub },
    },
  }

  const activity = await ctx.prisma.$transaction(async (prisma) => {
    // delete all instances that are not used anymore
    await prisma.elementInstance.deleteMany({
      where: {
        id: { in: instancesToDelete },
      },
    })

    // disconnect all instances that should be kept in edit mode and set new order value (to satisfy uniqueness constraints)
    for (const instance of persistentInstances) {
      const elementMultiplier =
        'pointsMultiplier' in instance.elementData
          ? ((instance.elementData.pointsMultiplier as number) ?? 1)
          : 1

      await prisma.elementInstance.update({
        where: {
          id: instance.id,
        },
        data: {
          elementBlockId: null,
          order: persistentInstanceOrderMap[instance.id],
          options: {
            ...instance.options,
            pointsMultiplier: multiplier * elementMultiplier,
          },
        },
      })
    }

    // delete all blocks
    await prisma.elementBlock.deleteMany({
      where: {
        id: { in: blocksToDelete },
      },
    })

    const upsertedQuiz = await prisma.liveQuiz.upsert({
      where: { id: id ?? uuidv4() },
      create: {
        ...createOrUpdateJSON,
        course:
          courseId !== null
            ? {
                connect: { id: courseId },
              }
            : undefined,
      },
      update: {
        ...createOrUpdateJSON,
        course:
          courseId !== null
            ? {
                connect: { id: courseId },
              }
            : {
                disconnect: true,
              },
      },
      include: {
        course: true,
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
    })

    await recomputeDerivedPermissions(
      {
        liveQuizId: upsertedQuiz.id,
      },
      prisma
    )

    return upsertedQuiz
  })

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id,
  })

  return activity
}
// #endregion

// ------ LIVE QUIZ GETTER FUNCTIONS (LECTURER) ------
// #region
export async function getLiveQuizData(
  {
    id,
  }: {
    id: string
  },
  ctx: ContextWithUser
) {
  if (!id) {
    return null
  }

  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, ownerId: ctx.user.sub },
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
      course: true,
    },
  })

  return quiz
}

export async function getUserLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      liveQuizzes: {
        where: {
          isDeleted: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          course: true,
          templateInfo: true,
          blocks: {
            orderBy: {
              order: 'asc',
            },
            include: {
              elements: {
                orderBy: {
                  order: 'asc',
                },
              },
              _count: {
                select: { elements: true },
              },
            },
          },
          _count: {
            select: { blocks: true },
          },
        },
      },
    },
  })

  return user?.liveQuizzes.map((quiz) => ({
    ...quiz,
    templateId: quiz.templateInfo?.id,
    blocks: quiz.blocks.map((block) => ({
      ...block,
      numOfParticipants: block.elements[0]
        ? block.elements[0].results.total +
          block.elements[0].anonymousResults.total
        : 0,
    })),
    course: quiz.course ? quiz.course : undefined,
    numOfBlocks: quiz._count?.blocks,
    numOfInstances: quiz.blocks.reduce(
      (acc, block) => acc + block._count?.elements,
      0
    ),
  }))
}

export async function getUserRunningLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      liveQuizzes: {
        where: {
          status: PublicationStatus.PUBLISHED,
        },
        include: {
          course: true,
        },
      },
    },
  })

  return user?.liveQuizzes ?? []
}

export async function getLecturerViewLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      confusionFeedbacks: true,
      feedbacks: {
        where: {
          isPinned: true,
        },
      },
    },
  })

  if (liveQuiz?.status !== PublicationStatus.PUBLISHED || !liveQuiz) {
    return null
  }

  // recude live quiz to only contain what is required for the lecturer cockpit
  const reducedQuiz = {
    ...liveQuiz,
    confusionSummary: aggregateFeedbacks(liveQuiz.confusionFeedbacks),
  }

  return reducedQuiz
}

export async function getControlLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      activeBlock: true,
      course: true,
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
  })

  if (!quiz || quiz?.status !== PublicationStatus.PUBLISHED) {
    return null
  }

  return quiz
}

export async function getShortnameQuizzes(
  { shortname }: { shortname: string },
  ctx: Context
) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      shortname: shortname.trim(),
    },
    include: {
      liveQuizzes: {
        where: {
          accessMode: AccessMode.PUBLIC,
          status: PublicationStatus.PUBLISHED,
        },
        include: {
          course: true,
        },
      },
    },
  })

  return user?.liveQuizzes ?? []
}

export async function getUnassignedLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      liveQuizzes: {
        where: {
          courseId: null,
          status: {
            in: [
              PublicationStatus.PUBLISHED,
              PublicationStatus.SCHEDULED,
              PublicationStatus.DRAFT,
            ],
          },
        },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })

  return user?.liveQuizzes ?? []
}
// #endregion

// ------ LIVE QUIZ EXECUTION (LECTURER) ------
// #region
export async function startLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  try {
    const quiz = await ctx.prisma.liveQuiz.findFirst({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: {
          in: [
            PublicationStatus.DRAFT,
            PublicationStatus.SCHEDULED,
            PublicationStatus.PUBLISHED,
          ],
        },
      },
      include: {
        blocks: {
          orderBy: {
            id: 'asc',
          },
        },
      },
    })

    // if there is no live quiz matching the current user and quiz id, exit early
    if (!quiz) {
      return null
    }

    switch (quiz.status) {
      case PublicationStatus.PUBLISHED:
        return quiz

      case PublicationStatus.DRAFT:
      case PublicationStatus.SCHEDULED: {
        try {
          await ctx.redisExec
            .pipeline()
            .hmset(`lq:${quiz.id}:meta`, {
              namespace: quiz.namespace,
              startedAt: Number(new Date()),
            })
            .exec()
        } catch (e) {
          console.error(e)
        }

        // generate a random pin code
        const pinCode = 100000 + Math.floor(Math.random() * 900000)
        const startedLiveQuiz = await ctx.prisma.liveQuiz.update({
          where: {
            id,
          },
          data: {
            status: PublicationStatus.PUBLISHED,
            startedAt: new Date(),
            pinCode: quiz.accessMode === AccessMode.RESTRICTED ? pinCode : null,
          },
        })

        await sendTeamsNotifications(
          'graphql/startLiveQuiz',
          `START Live quiz ${quiz.name} with id ${quiz.id}.`
        )

        return startedLiveQuiz
      }
    }
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/startLiveQuiz',
      `ERROR - failed to start live quiz: ${error}`
    )
    throw error
  }
}

export async function getCockpitQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      blocks: {
        orderBy: {
          order: 'asc',
        },
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      course: true,
      confusionFeedbacks: true,
      feedbacks: {
        include: {
          responses: true,
        },
      },
    },
  })

  if (!liveQuiz || liveQuiz?.status !== PublicationStatus.PUBLISHED) {
    return null
  }

  // number of participants per block
  const blockParticipants = liveQuiz.blocks.reduce<Record<number, number>>(
    (acc, block) => {
      acc[block.id] = block.elements.reduce(
        (instanceAcc, instance) =>
          min(
            instanceAcc,
            instance.results.total + instance.anonymousResults.total
          ),
        100000
      )
      return acc
    },
    {}
  )

  if (liveQuiz.activeBlock && liveQuiz.activeBlock.id) {
    const activeInstanceIds = liveQuiz.activeBlock?.elements.map(
      (instance) => instance.id
    )
    const redisMulti = ctx.redisExec.pipeline()
    activeInstanceIds?.forEach((instanceId) => {
      redisMulti.hgetall(`lq:${id}:i:${instanceId}:results`)
    })
    const cacheContent = (await redisMulti.exec()) as
      | [
          Error | null,
          {
            // TODO: extend type with more content of cache (as needed)
            participants: string
          },
        ][]
      | null

    const activeBlockParticipants = cacheContent
      ?.map(([_, result]) => parseInt(result?.participants))
      .reduce((acc, val) => min(acc, val), 100000)
    blockParticipants[liveQuiz.activeBlock.id] =
      activeBlockParticipants ?? blockParticipants[liveQuiz.activeBlock.id] ?? 0
  }

  // recude live quiz to only contain what is required for the lecturer cockpit
  const reducedQuiz = {
    ...liveQuiz,
    activeBlock: liveQuiz.activeBlock,
    blocks: liveQuiz.blocks.map((block) => {
      return {
        ...block,
        numOfParticipants: blockParticipants[block.id],
        elements: block.elements.map((instance) => {
          const elementData = instance.elementData
          if (
            !elementData ||
            typeof elementData !== 'object' ||
            Array.isArray(elementData)
          ) {
            return instance
          } else {
            return {
              ...instance,
              elementData: {
                ...elementData,
                options: null,
              },
            }
          }
        }),
      }
    }),
    confusionSummary: aggregateFeedbacks(liveQuiz.confusionFeedbacks),
  }

  return reducedQuiz
}

export async function activateLiveQuizBlock(
  { quizId, blockId }: { quizId: string; blockId: number },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
      ownerId: ctx.user.sub,
    },
    include: {
      blocks: {
        orderBy: {
          id: 'asc',
        },
      },
    },
  })

  if (!quiz || quiz.ownerId !== ctx.user.sub) return null

  const newBlock = quiz.blocks.find((block) => block.id === blockId)

  // if the block is not from the current quiz or it is already active, return early
  if (!newBlock || quiz.activeBlockId === blockId) return quiz

  // set the new block to active
  const updatedQuiz = await ctx.prisma.liveQuiz.update({
    where: { id: quizId },
    data: {
      activeBlock: {
        connect: { id: blockId },
      },
      blocks: {
        update: {
          where: { id: blockId },
          data: {
            status: ElementBlockStatus.ACTIVE,
            expiresAt: newBlock.timeLimit
              ? dayjs().add(newBlock.timeLimit, 'seconds').toDate()
              : undefined,
          },
        },
      },
    },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      blocks: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (updatedQuiz.activeBlock?.expiresAt) {
    scheduledJobs[blockId] = schedule.scheduleJob(
      dayjs(updatedQuiz.activeBlock.expiresAt).add(20, 'second').toDate(),
      async () => {
        await deactivateLiveQuizBlock({ quizId, blockId }, ctx, true)
        ctx.emitter.emit('invalidate', {
          typename: 'LiveQuiz',
          id: updatedQuiz.id,
        })
      }
    )
  }

  ctx.pubSub.publish('runningLiveQuizUpdated', updatedQuiz)

  // initialize the cache for the new active block
  const redisMulti = ctx.redisExec.pipeline()

  updatedQuiz.activeBlock!.elements.forEach((instance) => {
    const elementData = instance.elementData

    const commonInfo = {
      namespace: updatedQuiz.namespace,
      startedAt: Number(new Date()),
      sessionBlockId: blockId,
      type: elementData.type,
      basePoints: instance.options.basePoints,
      pointsMultiplier: instance.options.pointsMultiplier,
      defaultPoints: updatedQuiz.defaultPoints,
      defaultCorrectPoints: updatedQuiz.defaultCorrectPoints,
      maxBonusPoints: updatedQuiz.maxBonusPoints,
      timeToZeroBonus: updatedQuiz.timeToZeroBonus,
    }

    switch (elementData.type) {
      case ElementType.SC:
      case ElementType.MC:
      case ElementType.KPRIM: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          choiceCount: elementData.options.choices.length,
          solutions: elementData.options.hasSampleSolution
            ? JSON.stringify(
                elementData.options.choices
                  .map((choice, ix) => ({ ix, correct: choice.correct }))
                  .filter((choice) => choice.correct)
                  .map((choice) => choice.ix)
              )
            : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as ElementResultsChoices).choices,
        })
        break
      }

      case ElementType.NUMERICAL: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions:
            elementData.options.exactSolutions &&
            elementData.options.exactSolutions.length > 0
              ? JSON.stringify(elementData.options.exactSolutions)
              : elementData.options.solutionRanges
                ? JSON.stringify(elementData.options.solutionRanges)
                : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }

      case ElementType.FREE_TEXT: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: elementData.options.hasSampleSolution
            ? JSON.stringify(elementData.options.solutions)
            : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }

      case ElementType.SELECTION: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: JSON.stringify(
            elementData.options.answerCollectionSolutionIds
          ),
          numberOfInputs: elementData.options.numberOfInputs,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
          ...(instance.results as ElementResultsSelection).selections,
        })
        break
      }

      case ElementType.CASE_STUDY: {
        // convert solutions to object for faster access
        const validSolutions = elementData.options.cases.every(
          (caseItem) => caseItem.solutions
        )
        const solutions =
          elementData.options.hasSampleSolution && validSolutions
            ? elementData.options.cases.map((caseItem) => ({
                caseId: caseItem.id,
                itemSolutions: caseItem.solutions,
              }))
            : undefined

        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, {
          ...commonInfo,
          solutions: solutions ? JSON.stringify(solutions) : undefined,
        })
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }

      case ElementType.CONTENT: {
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:info`, commonInfo)
        redisMulti.hmset(`lq:${quiz.id}:i:${instance.id}:results`, {
          participants: 0,
        })
        break
      }
    }
  })

  redisMulti.exec()
  return updatedQuiz
}

export async function deactivateLiveQuizBlock(
  { quizId, blockId }: { quizId: string; blockId: number },
  ctx: ContextWithUser,
  isScheduled?: boolean
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
      ownerId: ctx.user.sub,
    },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      blocks: {
        orderBy: {
          id: 'asc',
        },
      },
    },
  })

  if (!quiz || quiz.ownerId !== ctx.user.sub || !quiz.activeBlock) return null

  // if the block is not the active one, return early
  if (quiz.activeBlockId !== blockId) return quiz

  try {
    const cachedResults = await getCachedBlockResults({
      ctx,
      activeBlock: quiz.activeBlock,
    })

    if (!cachedResults) return null

    const { instanceResults, liveQuizLeaderboard, activeInstanceIds } =
      cachedResults

    const existingParticipantsLB = (
      await Promise.allSettled(
        Object.entries(liveQuizLeaderboard).map(async ([id, score]) => {
          const participant = await ctx.prisma.participant.findUnique({
            where: { id },
          })

          if (!participant) return null

          return [id, score] as [string, string]
        })
      )
    ).flatMap((result) => {
      if (result.status !== 'fulfilled' || !result.value) return []
      return [result.value]
    })

    const updatedQuiz = await ctx.prisma.liveQuiz.update({
      where: {
        id: quizId,
      },
      data: {
        activeBlock: {
          disconnect: true,
        },
        blocks: {
          update: {
            where: {
              id: blockId,
            },
            data: {
              status: ElementBlockStatus.EXECUTED,
              elements: {
                update: Object.entries(instanceResults).map(
                  ([id, instanceResult]) => ({
                    where: { id: Number(id) },
                    data: { anonymousResults: instanceResult.anonymousResults },
                  })
                ),
              },
            },
          },
        },
        leaderboard: quiz.isGamificationEnabled
          ? {
              upsert: existingParticipantsLB.map(
                ([id, score]: [string, string]) => ({
                  where: {
                    type_participantId_liveQuizId: {
                      type: LeaderboardType.SESSION,
                      participantId: id,
                      liveQuizId: quizId,
                    },
                  },
                  create: {
                    type: LeaderboardType.SESSION,
                    participant: {
                      connect: { id },
                    },
                    score: parseInt(score),
                    sessionParticipation: {
                      connectOrCreate: {
                        where: {
                          courseId_participantId: {
                            courseId: quiz.courseId!,
                            participantId: id,
                          },
                        },
                        create: {
                          course: {
                            connect: {
                              id: quiz.courseId!,
                            },
                          },
                          participant: {
                            connect: {
                              id,
                            },
                          },
                        },
                      },
                    },
                  },
                  update: {
                    score: parseInt(score),
                  },
                })
              ),
            }
          : undefined,
      },
      include: {
        blocks: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    ctx.pubSub.publish('runningLiveQuizUpdated', {
      ...updatedQuiz,
      activeBlock: null,
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id: quiz.id,
    })

    if (!isScheduled && scheduledJobs[blockId]) {
      await scheduledJobs[blockId].cancel()
      delete scheduledJobs[blockId]
    }

    unlinkCachedBlockResults({
      ctx,
      quizId,
      blockId,
      activeInstanceIds,
    })

    return updatedQuiz
  } catch (error: any) {
    await sendTeamsNotifications(
      'graphql/deactivateLiveQuizBlock',
      `ERROR - failed to deactivate block ${blockId} in live quiz ${
        quiz.id
      } with active block ${quiz.activeBlockId}: ${error?.message || error}`
    )

    throw error
  }
}

export async function endLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findFirst({
    where: {
      id,
      ownerId: ctx.user.sub,
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
          id: 'asc',
        },
      },
    },
  })

  // if there is no live quiz matching the current user and quiz id, exit early
  if (!quiz) {
    return null
  }

  if (quiz.status === PublicationStatus.ENDED) {
    return quiz
  }
  if (
    quiz.status === PublicationStatus.DRAFT ||
    quiz.status === PublicationStatus.SCHEDULED
  ) {
    return null
  }

  try {
    const quizLB = await ctx.redisExec.hgetall(`lq:${id}:lb`)
    const quizXP = await ctx.redisExec.hgetall(`lq:${id}:xp`)

    const participants: Record<string, any> = {}

    Object.entries(quizXP).forEach(([id, xp]) => {
      participants[id] = {
        xp: parseInt(xp),
      }
    })
    Object.entries(quizLB).forEach(([id, score]) => {
      participants[id] = {
        ...(participants[id] ?? {}),
        score: parseInt(score),
      }
    })

    // quizXP should always be around as soon as there are logged-in participants (check first)
    // quizLB only for live quizzes that are compatible with points collection (check second)
    if (quizXP) {
      let existingParticipants: {
        id: string
        score?: number
        xp?: number
        hasParticipation?: boolean
      }[] = (
        await Promise.allSettled(
          Object.entries(participants).map(async ([id, { score, xp }]) => {
            const participant = await ctx.prisma.participant.findUnique({
              where: { id },
              include: {
                // if the live quiz is part of a course, include the corresponding participations
                // if the participant is not part of the relevant course, the joined array will be empty
                participations: quiz.courseId
                  ? {
                      where: {
                        courseId: quiz.courseId,
                      },
                    }
                  : undefined,
              },
            })

            if (!participant) return null

            return {
              id,
              score,
              xp,
              hasParticipation: participant.participations?.[0]?.isActive,
            }
          })
        )
      ).flatMap((result) => {
        if (result.status !== 'fulfilled' || !result.value) return []
        return [result.value]
      })

      // track the achievement ids, which should be awarded to the participants
      let newAchievements: Record<string, number> = {}

      // only award achievements, if the live quiz did contain questions with sample
      // solutions and at least three participants collected points
      const awardAchievements = quiz.blocks.some(
        (block) =>
          block.elements.some((instance) => {
            return instance.elementType !== ElementType.CONTENT &&
              'hasSampleSolution' in instance.elementData.options
              ? (instance.elementData.options.hasSampleSolution ?? false)
              : false
          }) &&
          existingParticipants.filter(
            ({ score }) => typeof score !== 'undefined'
          ).length >= 3
      )

      // award achievements to the top 3 participants (and all others with equal scores)
      if (awardAchievements) {
        const topScores = existingParticipants
          .filter(({ score }) => typeof score !== 'undefined')
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, 3)

        const firstRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: FIRST_ACHIEVEMENT_ID },
        })
        const secondRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: SECOND_ACHIEVEMENT_ID },
        })
        const thirdRankAchievement = await ctx.prisma.achievement.findUnique({
          where: { id: THIRD_ACHIEVEMENT_ID },
        })

        const goldScore = topScores[0]?.score
        const silverScore = topScores[1]?.score
        const bronzeScore = topScores[2]?.score

        // awarding logic (including point and xp updates):
        // award gold to every participant with gold score
        // award silver to every participant with silver score, if silver score != gold score
        // award bronze to every participant with bronze score, if bronze score != silver score
        existingParticipants = existingParticipants.map((participant) => {
          if (
            typeof participant.score === 'undefined' ||
            typeof participant.xp === 'undefined'
          ) {
            return participant
          }

          if (participant.score === goldScore) {
            participant.xp += firstRankAchievement!.rewardedXP ?? 0
            participant.score += firstRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = firstRankAchievement!.id
          }
          if (participant.score === silverScore && silverScore !== goldScore) {
            participant.xp += secondRankAchievement!.rewardedXP ?? 0
            participant.score += secondRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = secondRankAchievement!.id
          }
          if (
            participant.score === bronzeScore &&
            bronzeScore !== silverScore
          ) {
            participant.xp += thirdRankAchievement!.rewardedXP ?? 0
            participant.score += thirdRankAchievement!.rewardedPoints ?? 0
            newAchievements[participant.id] = thirdRankAchievement!.id
          }

          return participant
        })
      }

      // execute XP and points in the same transaction to prevent issues when one fails
      // the live quiz update later on should never fail, but we need the return value (keep separate)
      await ctx.prisma.$transaction(async (prisma) => {
        // process XP updates
        for (const participant of existingParticipants) {
          if (typeof participant.xp !== 'undefined') {
            await prisma.participant.update({
              where: { id: participant.id },
              data: {
                xp: {
                  increment: Number(participant.xp),
                },
              },
            })
          }
        }

        // if the live quiz is part of a course, update the course leaderboard
        // with the accumulated points and award achievements
        if (quizLB && quiz.courseId) {
          for (const participant of existingParticipants) {
            if (
              typeof participant.score !== 'undefined' &&
              participant.hasParticipation
            ) {
              // award points, if the student is a participant in the course
              await prisma.leaderboardEntry.upsert({
                where: {
                  type_participantId_courseId: {
                    type: LeaderboardType.COURSE,
                    courseId: quiz.courseId,
                    participantId: participant.id,
                  },
                },
                include: {
                  participation: true,
                  participant: true,
                },
                create: {
                  type: LeaderboardType.COURSE,
                  course: { connect: { id: quiz.courseId } },
                  participant: { connect: { id: participant.id } },
                  participation: {
                    connectOrCreate: {
                      where: {
                        courseId_participantId: {
                          courseId: quiz.courseId,
                          participantId: participant.id,
                        },
                      },
                      create: {
                        course: { connect: { id: quiz.courseId } },
                        participant: { connect: { id: participant.id } },
                      },
                    },
                  },
                  score: participant.score,
                },
                update: {
                  score: { increment: participant.score },
                },
              })
            }

            // update daily timeline entries
            if (
              typeof participant.xp !== 'undefined' ||
              (typeof participant.score !== 'undefined' &&
                participant.hasParticipation)
            ) {
              await upsertDailyTimelineEntry({
                prisma,
                participantId: participant.id,
                courseId: quiz.courseId,
                xpAwarded: participant.xp,
                pointsAwarded: participant.hasParticipation
                  ? participant.score
                  : undefined,
              })
            }

            // award achievements if participant has achieved high scores / ...
            if (typeof newAchievements[participant.id] !== 'undefined') {
              await prisma.participant.update({
                where: { id: participant.id },
                data: {
                  achievements: {
                    upsert: {
                      where: {
                        participantId_achievementId: {
                          participantId: participant.id,
                          achievementId: newAchievements[participant.id]!,
                        },
                      },
                      create: {
                        achievedAt: new Date(),
                        achievedCount: 1,
                        achievement: {
                          connect: { id: newAchievements[participant.id]! },
                        },
                      },
                      update: {
                        achievedCount: { increment: 1 },
                      },
                    },
                  },
                },
              })
            }
          }
        }
      })
    }

    const keys = await ctx.redisExec.keys(`lq:${id}:*`)
    const pipe = ctx.redisExec.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    const endedLiveQuiz = await ctx.prisma.liveQuiz.update({
      where: {
        id,
      },
      data: {
        status: PublicationStatus.ENDED,
        finishedAt: new Date(),
        pinCode: null,
      },
    })

    await sendTeamsNotifications(
      'graphql/endLiveQuiz',
      `END Live quiz ${quiz.name} with id ${quiz.id}.`
    )

    return endedLiveQuiz
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/endLiveQuiz',
      `ERROR - failed to end live quiz ${quiz.name} with id ${quiz.id}: ${error}`
    )
    throw error
  }
}

export async function changeLiveQuizSettings(
  {
    id,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    isGamificationEnabled,
  }: {
    id: string
    isLiveQAEnabled?: boolean | null
    isConfusionFeedbackEnabled?: boolean | null
    isModerationEnabled?: boolean | null
    isGamificationEnabled?: boolean | null
  },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      isLiveQAEnabled: isLiveQAEnabled ?? undefined,
      isConfusionFeedbackEnabled: isConfusionFeedbackEnabled ?? undefined,
      isModerationEnabled: isModerationEnabled ?? undefined,
      isGamificationEnabled: isGamificationEnabled ?? undefined,
    },
  })
  return quiz
}

export async function changeLiveQuizName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const updatedQuiz = await ctx.prisma.liveQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      name,
      displayName,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id,
  })

  return updatedQuiz
}

export async function getLiveQuizSummary(
  { quizId }: { quizId: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
      ownerId: ctx.user.sub,
    },
    include: {
      _count: {
        select: {
          feedbacks: true,
          confusionFeedbacks: true,
          leaderboard: true,
        },
      },
      blocks: {
        include: {
          elements: true,
        },
      },
      activeBlock: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!liveQuiz) return null

  // get responses for completed blocks
  let storedResponses = liveQuiz.blocks.reduce((acc_b, block) => {
    acc_b += block.elements.reduce((acc_i, instance) => {
      acc_i += instance.results.total + instance.anonymousResults.total
      return acc_i
    }, 0)
    return acc_b
  }, 0)

  // get results for active blocks
  if (liveQuiz.activeBlock) {
    const cachedResults = await getCachedBlockResults({
      ctx,
      activeBlock: liveQuiz.activeBlock,
    })

    if (cachedResults) {
      const { instanceResults } = cachedResults
      const cachedResponses = liveQuiz.activeBlock.elements.reduce(
        (acc, instance) => {
          acc += instanceResults[instance.id]?.anonymousResults.total ?? 0
          return acc
        },
        0
      )

      storedResponses += cachedResponses
    }
  }

  return {
    numOfResponses: storedResponses,
    numOfFeedbacks: liveQuiz._count.feedbacks,
    numOfConfusionFeedbacks: liveQuiz._count.confusionFeedbacks,
    numOfLeaderboardEntries: liveQuiz._count.leaderboard,
  }
}

export async function cancelLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      activeBlock: true,
      blocks: {
        include: {
          elements: true,
          activeInLiveQuiz: true,
        },
      },
      leaderboard: true,
    },
  })

  if (!quiz) return null

  try {
    if (quiz.status !== PublicationStatus.PUBLISHED) {
      throw new Error('Live quiz is not running')
    }

    const instances = quiz.blocks.flatMap((block) => block.elements)

    const [updatedQuiz] = await ctx.prisma.$transaction([
      ctx.prisma.liveQuiz.update({
        where: { id },
        data: {
          status: PublicationStatus.DRAFT,
          startedAt: null,
          pinCode: null,
          activeBlock: {
            disconnect: true,
          },
          leaderboard: {
            deleteMany: {},
          },
          feedbacks: {
            deleteMany: {},
          },
          confusionFeedbacks: {
            deleteMany: {},
          },
          blocks: {
            updateMany: {
              where: {
                status: {
                  in: [ElementBlockStatus.EXECUTED, ElementBlockStatus.ACTIVE],
                },
              },
              data: {
                status: ElementBlockStatus.SCHEDULED,
                expiresAt: null,
                execution: {
                  increment: 1,
                },
              },
            },
          },
        },
        include: {
          activeBlock: true,
          blocks: {
            include: {
              elements: true,
              activeInLiveQuiz: true,
            },
          },
        },
      }),

      ...instances.map((instance) => {
        const initialResults = getInitialInstanceResults(instance.elementData)

        return ctx.prisma.elementInstance.update({
          where: {
            id: instance.id,
          },
          data: {
            results: initialResults,
            anonymousResults: initialResults,
          },
        })
      }),
    ])

    const keys = await ctx.redisExec.keys(`lq:${id}:*`)
    const pipe = ctx.redisExec.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    await sendTeamsNotifications(
      'graphql/abortLiveQuiz',
      `CANCEL Live quiz ${quiz.name} with id ${quiz.id}.`
    )

    return updatedQuiz
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/abortLiveQuiz',
      `ERROR - failed to cancel live quiz ${quiz.name} with id ${quiz.id}: ${error}`
    )
    throw error
  }
}

export async function getLiveQuizEvaluation(
  { id, hmac }: { id: string; hmac?: string | null },
  ctx: Context
) {
  if ((!ctx.user?.sub && typeof hmac !== 'string') || hmac == '') {
    return null
  }

  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      status: { in: [PublicationStatus.PUBLISHED, PublicationStatus.ENDED] },
      isDeleted: false,
    },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      blocks: {
        orderBy: {
          order: 'asc',
        },
        where: {
          status: {
            equals: ElementBlockStatus.EXECUTED,
          },
        },
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      feedbacks: {
        include: {
          responses: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      confusionFeedbacks: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  if (!liveQuiz) {
    return null
  }

  if (typeof hmac === 'string') {
    const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
    hmacEncoder.update(liveQuiz.namespace + liveQuiz.id)
    const quizHmac = hmacEncoder.digest('hex')

    // evaluate whether the hashed liveQuiz.namespace and liveQuiz.id equals the hmac
    if (quizHmac !== hmac) {
      return null
    }
  }

  // load results from active block as well
  let activeBlockWithResults:
    | (ElementBlock & { elements: ElementInstance[] })
    | undefined
  if (liveQuiz.activeBlockId && liveQuiz.activeBlock) {
    const cachedResults = await getCachedBlockResults({
      ctx,
      activeBlock: liveQuiz.activeBlock,
    })

    if (cachedResults) {
      const { instanceResults } = cachedResults

      activeBlockWithResults = {
        ...liveQuiz.activeBlock,
        elements: liveQuiz.activeBlock.elements.map((instance) => ({
          ...instance,
          anonymousResults:
            instanceResults[instance.id]?.anonymousResults ??
            instance.anonymousResults,
        })),
      }
    }
  }

  // compute evaluation
  const blockEvaluations = computeStackEvaluation(
    typeof activeBlockWithResults !== 'undefined'
      ? [...liveQuiz.blocks, activeBlockWithResults]
      : liveQuiz.blocks
  )

  return {
    id: liveQuiz.id,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    description: liveQuiz.description,
    results: blockEvaluations,
    feedbacks:
      liveQuiz.status === PublicationStatus.ENDED ? liveQuiz.feedbacks : null, // only shown on evaluation for completed quizzes
    confusionFeedbacks:
      liveQuiz.status === PublicationStatus.ENDED
        ? liveQuiz.confusionFeedbacks
        : null, // only shown on evaluation for completed quizzes
  }
}
// #endregion

// ------ LIVE QUIZ MANAGEMENT (DELETION / EMBEDDING / ...) ------
// #region
export async function deleteLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch live quiz to check its status, remember the contained elements
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!liveQuiz) return null

  if (liveQuiz.status === PublicationStatus.PUBLISHED) {
    // running live quizzes cannot be deleted
    return null
  } else if (liveQuiz.status === PublicationStatus.ENDED) {
    const deletedLiveQuiz = await ctx.prisma.$transaction(async (prisma) => {
      const quiz = await prisma.liveQuiz.update({
        where: {
          id,
          ownerId: ctx.user.sub,
          status: PublicationStatus.ENDED,
        },
        data: {
          isDeleted: true,
        },
      })

      // update derived permissions for this live quiz (after soft deletion)
      // this function call automatically includes permission updates for all linked elements
      await recomputeDerivedPermissions({ liveQuizId: quiz.id }, prisma)

      return quiz
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id,
    })

    return deletedLiveQuiz
  } else {
    const deletedLiveQuiz = await ctx.prisma.$transaction(async (prisma) => {
      const quiz = await prisma.liveQuiz.delete({
        where: {
          id,
          ownerId: ctx.user.sub,
          status: {
            in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
          },
        },
      })

      // update derived permissions on all linked elements (to make sure that invalid derived permissions are also removed)
      // this case cannot be handled by the permissions module, since the live quiz is already hard deleted
      await propagateActivityToElements({ stacks: liveQuiz.blocks }, prisma)

      return quiz
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id,
    })

    return deletedLiveQuiz
  }
}

export async function getLiveQuizHMAC(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
    },
  })

  if (!quiz) return null

  const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
  hmacEncoder.update(quiz.namespace + quiz.id)
  const quizHmac = hmacEncoder.digest('hex')

  return quizHmac
}

// compute the average of all feedbacks that were given within the last 10 minutes
const aggregateFeedbacks = (feedbacks: ConfusionTimestep[]) => {
  // TODO: for improved efficiency, try to use descending feedback ordering
  // and break early once first is not within the filtering requirements anymore
  const recentFeedbacks = feedbacks.filter(
    (feedback) =>
      dayjs().diff(dayjs(feedback.createdAt)) > 0 &&
      dayjs().diff(dayjs(feedback.createdAt)) < 1000 * 60 * 10
  )

  if (recentFeedbacks.length > 0) {
    const summedFeedbacks = recentFeedbacks.reduce(
      (previousValue, feedback) => {
        return {
          speed: previousValue.speed + feedback.speed,
          difficulty: previousValue.difficulty + feedback.difficulty,
          numberOfParticipants: previousValue.numberOfParticipants + 1,
        }
      },
      { speed: 0, difficulty: 0, numberOfParticipants: 0 }
    )
    return {
      ...summedFeedbacks,
      speed: summedFeedbacks.speed / summedFeedbacks.numberOfParticipants,
      difficulty:
        summedFeedbacks.difficulty / summedFeedbacks.numberOfParticipants,
    }
  }
  return { speed: 0, difficulty: 0, numberOfParticipants: 0 }
}
// #endregion

// ------ LIVE QUIZ GETTER FUNCTIONS (STUDENT) ------
// #region
export async function getRunningLiveQuiz({ id }: { id: string }, ctx: Context) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      course: true,
      blocks: true,
    },
  })

  // check if any block has been started / completed
  const beforeFirstBlock = quiz?.blocks?.every(
    (block) => block.status === ElementBlockStatus.SCHEDULED
  )

  // extract solution from instances in active block
  let quizWithoutSolutions: any
  if (quiz && quiz.activeBlock) {
    quizWithoutSolutions = {
      ...quiz,
      beforeFirstBlock,
      activeBlock: {
        ...quiz.activeBlock,
        elements: quiz.activeBlock.elements.map((instance) => {
          const elementData = instance.elementData
          if (
            !elementData ||
            typeof elementData !== 'object' ||
            Array.isArray(elementData)
          )
            return instance

          switch (elementData.type) {
            case ElementType.SC:
            case ElementType.MC:
              return {
                ...instance,
                elementData: {
                  ...elementData,
                  options: {
                    ...elementData.options,
                    choices: elementData.options.choices.map((choice) => ({
                      ...pick(choice, ['ix', 'value']),
                    })),
                  },
                },
              }

            case ElementType.NUMERICAL:
            case ElementType.FREE_TEXT:
              return {
                ...instance,
                elementData,
              }

            default:
              return instance
          }
        }),
      },
    }
  }

  if (quiz?.status === PublicationStatus.PUBLISHED) {
    return quizWithoutSolutions ?? { ...quiz, beforeFirstBlock }
  }

  return null
}

export async function getCourseRunningLiveQuizzes(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      liveQuizzes: {
        where: {
          status: PublicationStatus.PUBLISHED,
        },
        include: {
          course: true,
        },
      },
    },
  })

  return course?.liveQuizzes ?? []
}

export async function getLiveQuizLeaderboard(
  { quizId }: { quizId: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
    },
    include: {
      leaderboard: {
        orderBy: {
          score: 'desc',
        },
        include: {
          participant: true,
          sessionParticipation: true,
        },
      },
      blocks: true,
    },
  })

  if (!quiz) return []

  const participant = ctx.user?.sub
    ? await ctx.prisma.participant.findUnique({
        where: {
          id: ctx.user.sub,
        },
      })
    : null

  const participantProfilePublic =
    (participant?.isProfilePublic ?? false) ||
    ctx.user?.role === 'USER' ||
    ctx.user?.role === 'ADMIN'

  // find the order attribute of the last exectued block
  const executedBlockOrders = quiz?.blocks
    .filter((quizBlock) => quizBlock.status === ElementBlockStatus.EXECUTED)
    .map((quizBlock) => Number(quizBlock.order))

  const lastBlockOrder = executedBlockOrders
    ? Math.max(...executedBlockOrders)
    : 0

  const preparedEntries = quiz?.leaderboard?.flatMap((entry) => {
    if (!entry.sessionParticipation?.isActive) return []

    return {
      id: entry.id,
      participantId: entry.participant.id,
      username:
        entry.participant.isProfilePublic && participantProfilePublic
          ? entry.participant.username
          : 'Anonymous',
      avatar:
        entry.participant.isProfilePublic && participantProfilePublic
          ? entry.participant.avatar
          : null,
      score: entry.score,
      level: levelFromXp(entry.participant.xp),
      // isSelf: entry.participantId === ctx.user.sub,
      lastBlockOrder,
    }
  })

  const sortedEntries = sortBy(
    preparedEntries,
    [prop('score'), 'desc'],
    [prop('username'), 'asc']
  )

  const filteredEntries = sortedEntries.flatMap((entry, ix) => {
    return { ...entry, rank: ix + 1 }
  })

  return filteredEntries
}
// #endregion
