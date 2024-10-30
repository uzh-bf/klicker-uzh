import {
  type Element,
  ElementInstanceType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import type { BlockInput } from '@klicker-uzh/types'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'

interface ManipulateLiveQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  blocks: BlockInput[]
  courseId?: string | null
  multiplier: number
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
    maxBonusPoints,
    timeToZeroBonus,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
  }: ManipulateLiveQuizArgs,
  ctx: ContextWithUser
) {
  if (id) {
    // find all instances belonging to the old quiz and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
        isDeleted: false,
      },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!oldElement) {
      throw new GraphQLError('Live quiz not found')
    }
    if (oldElement.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published live quiz')
    }

    await ctx.prisma.liveQuiz.update({
      where: { id },
      data: {
        blocks: {
          deleteMany: {},
        },
      },
    })
  }

  const elements = blocks
    .flatMap((block) => block.elements)
    .map((blockElem) => blockElem.elementId)
    .filter(
      (blockElem) => blockElem !== null && typeof blockElem !== 'undefined'
    )

  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elements },
      ownerId: ctx.user.sub,
    },
  })

  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }

  const elementMap = dbElements.reduce<Record<number, Element>>(
    (acc, elem) => ({ ...acc, [elem.id]: elem }),
    {}
  )

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    maxBonusPoints: maxBonusPoints ?? undefined,
    timeToZeroBonus: timeToZeroBonus ?? undefined,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
    blocks: {
      create: blocks.map((block) => {
        return {
          order: block.order,
          elements: {
            create: block.elements.map((elem) => {
              const element = elementMap[elem.elementId]!
              const processedElementData = processElementData(element)
              const initialResults = getInitialElementResults(element)

              return {
                elementType: element.type,
                migrationId: uuidv4(),
                order: elem.order,
                type: ElementInstanceType.LIVE_QUIZ,
                elementData: processedElementData,
                options: {
                  pointsMultiplier: multiplier * element.pointsMultiplier,
                },
                results: initialResults,
                anonymousResults: initialResults,
                instanceStatistics: {
                  create: getInitialInstanceStatistics(
                    ElementInstanceType.LIVE_QUIZ
                  ),
                },
                element: {
                  connect: { id: element.id },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            }),
          },
        }
      }),
    },
    owner: {
      connect: { id: ctx.user.sub },
    },
    course: courseId
      ? {
          connect: { id: courseId },
        }
      : undefined,
  }

  const element = await ctx.prisma.liveQuiz.upsert({
    where: { id: id ?? uuidv4() },
    create: createOrUpdateJSON,
    update: createOrUpdateJSON,
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

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id,
  })

  return element
}
