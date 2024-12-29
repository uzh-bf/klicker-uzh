import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma'
import { DisplayMode } from '@klicker-uzh/types'
import { getInitialElementResults, processElementData } from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import dayjs from 'dayjs'
import { prop, sortBy, swapIndices } from 'remeda'
import type { ContextWithUser } from '../lib/context.js'

function processElementOptions(elementType: DB.ElementType, options: any) {
  switch (elementType) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM: {
      return {
        displayMode: options.displayMode ?? DisplayMode.LIST,
        hasSampleSolution: options.hasSampleSolution ?? false,
        hasAnswerFeedbacks: options.hasAnswerFeedbacks ?? false,
        choices: options.choices,
      }
    }

    case DB.ElementType.NUMERICAL: {
      return {
        hasSampleSolution: options?.hasSampleSolution ?? false,
        unit: options?.unit ?? undefined,
        accuracy: options?.accuracy ?? undefined,
        placeholder: options?.placeholder ?? undefined,
        restrictions: {
          ...options?.restrictions,
          min: options?.restrictions?.min ?? undefined,
          max: options?.restrictions?.max ?? undefined,
        },
        solutionRanges: options?.solutionRanges ?? undefined,
        exactSolutions: options?.exactSolutions ?? undefined,
      }
    }

    case DB.ElementType.FREE_TEXT: {
      return {
        hasSampleSolution: options?.hasSampleSolution ?? false,
        solutions: options?.solutions ?? undefined,
        restrictions: {
          ...options?.restrictions,
          maxLength: options?.restrictions?.maxLength ?? undefined,
        },
      }
    }

    default: {
      return {}
    }
  }
}

export async function getUserQuestions(ctx: ContextWithUser) {
  const userQuestions = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      questions: {
        where: {
          isDeleted: false,
        },
        orderBy: [
          {
            createdAt: 'desc',
          },
        ],
        include: {
          tags: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
    },
  })

  return userQuestions?.questions
}

export async function getSingleQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const question = await ctx.prisma.element.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      tags: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  return question
}

export async function getArtificialElementInstance(
  {
    elementId,
  }: {
    elementId: number
  },
  ctx: ContextWithUser
) {
  const element = await ctx.prisma.element.findUnique({
    where: {
      id: elementId,
      ownerId: ctx.user.sub,
    },
  })

  if (!element) return null

  const elementData = processElementData(element)
  const initialResults = getInitialElementResults(element)

  return {
    id: 0,
    elementId: element.id,
    migrationId: '',
    originalId: '',
    elementType: element.type,
    order: 0,
    type: DB.ElementInstanceType.LIVE_QUIZ,
    elementData,
    options: {
      pointsMultiplier: element.pointsMultiplier,
    },
    results: initialResults,
    anonymousResults: initialResults,
    ownerId: '',
    elementBlockId: 0,
    elementStackId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

interface QuestionOptionsArgs {
  unit?: string | null
  accuracy?: number | null
  placeholder?: string | null
  restrictions?: {
    maxLength?: number | null
    minLength?: number | null
    pattern?: string | null
    min?: number | null
    max?: number | null
  } | null
  feedback?: string | null
  solutionRanges?: { min?: number | null; max?: number | null }[] | null
  exactSolutions?: number[] | null
  solutions?: string[] | null
  choices?:
    | {
        ix: number
        value: string
        correct?: boolean | null
        feedback?: string | null
      }[]
    | null
  displayMode?: DisplayMode | null
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
  pointsMultiplier?: number | null
}

interface ManipulateQuestionArgs {
  id?: number | null
  status?: DB.ElementStatus | null
  type: DB.ElementType
  name?: string | null
  content?: string | null
  explanation?: string | null
  options?: QuestionOptionsArgs | null
  pointsMultiplier?: number | null
  tags?: string[] | null
}

export async function manipulateQuestion(
  {
    id,
    status,
    type,
    name,
    content,
    explanation,
    options,
    pointsMultiplier,
    tags,
  }: ManipulateQuestionArgs,
  ctx: ContextWithUser
) {
  let tagsToDelete: string[] = []

  const questionPrev =
    typeof id !== 'undefined' && id !== null
      ? await ctx.prisma.element.findUnique({
          where: {
            id: id,
            ownerId: ctx.user.sub,
          },
          include: {
            tags: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        })
      : undefined

  if (questionPrev?.tags) {
    tagsToDelete = questionPrev.tags
      .filter((tag) => !tags?.includes(tag.name))
      .map((tag) => tag.name)
  }

  const question = await ctx.prisma.element.upsert({
    where: {
      id: typeof id !== 'undefined' && id !== null ? id : -1,
    },
    create: {
      status: status ?? undefined,
      type,
      name: name ?? 'Missing Question Title',
      content: content ?? 'Missing Question Content',
      explanation: explanation ?? undefined,
      pointsMultiplier: pointsMultiplier ?? 1,
      options: processElementOptions(type, options),
      owner: {
        connect: {
          id: ctx.user.sub,
        },
      },
      // connect to the tags which already exist by name and otherwise create a new tag with the given name
      tags: {
        connectOrCreate: tags?.map((tag: string) => {
          return {
            where: {
              ownerId_name: {
                ownerId: ctx.user.sub,
                name: tag,
              },
            },
            create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
          }
        }),
      },
    },
    update: {
      status: status ?? undefined,
      name: name ?? undefined,
      content: content ?? undefined,
      explanation: typeof explanation === 'undefined' ? undefined : explanation,
      pointsMultiplier: pointsMultiplier ?? 1,
      version: {
        increment: 1,
      },
      options: options ? processElementOptions(type, options) : undefined,
      tags: {
        connectOrCreate: tags
          ?.filter((tag: string) => tag !== '')
          .map((tag: string) => {
            return {
              where: {
                ownerId_name: {
                  ownerId: ctx.user.sub,
                  name: tag,
                },
              },
              create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
            }
          }),
        disconnect: tagsToDelete.map((tag) => {
          return {
            ownerId_name: {
              ownerId: ctx.user.sub,
              name: tag,
            },
          }
        }),
      },
    },
    include: {
      tags: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: question.id,
  })

  return question
}

export async function deleteQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const question = await ctx.prisma.element.update({
    where: {
      id: id,
      ownerId: ctx.user.sub,
    },
    data: {
      isDeleted: true,
    },
  })

  // TODO: Once migration deadline is over, rework approach and delete question for real
  // const question = await ctx.prisma.element.delete({
  //   where: {
  //     id: id,
  //     ownerId: ctx.user.sub,
  //   },
  // })

  // ctx.emitter.emit('invalidate', {
  //   typename: 'Element',
  //   id: question.id,
  // })

  return question
}

export async function editTag(
  { id, name }: { id: number; name: string },
  ctx: ContextWithUser
) {
  const tag = await ctx.prisma.tag.update({
    where: {
      id: id,
      ownerId: ctx.user.sub,
    },
    data: {
      name: name,
    },
  })

  return tag
}

export async function deleteTag({ id }: { id: number }, ctx: ContextWithUser) {
  const tag = await ctx.prisma.tag.delete({
    where: {
      id: id,
      ownerId: ctx.user.sub,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Tag',
    id: tag.id,
  })

  return tag
}

export async function updateTagOrdering(
  { originIx, targetIx }: { originIx: number; targetIx: number },
  ctx: ContextWithUser
) {
  const tags = await ctx.prisma.tag.findMany({
    where: {
      ownerId: ctx.user.sub,
    },
    orderBy: {
      order: 'asc',
    },
  })

  const sortedTags = sortBy(tags, [prop('order'), 'asc'], [prop('name'), 'asc'])
  const reorderedTags = swapIndices(sortedTags, originIx, targetIx)

  await ctx.prisma.$transaction(
    reorderedTags.map((tag, ix) =>
      ctx.prisma.tag.update({
        where: { id: tag.id },
        data: { order: ix },
      })
    )
  )

  return reorderedTags
}

export async function toggleIsArchived(
  { questionIds, isArchived }: { questionIds: number[]; isArchived: boolean },
  ctx: ContextWithUser
) {
  await ctx.prisma.element.updateMany({
    where: {
      id: {
        in: questionIds,
      },
      ownerId: ctx.user.sub,
    },
    data: {
      isArchived,
    },
  })

  return questionIds.map((id) => ({
    id,
    isArchived,
  }))
}

// map mime types of images to file extensions
const FILE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
}

export async function getFileUploadSas(
  { fileName, contentType }: { fileName: string; contentType: string },
  ctx: ContextWithUser
) {
  const sharedKeyCredential = new StorageSharedKeyCredential(
    process.env.BLOB_STORAGE_ACCOUNT_NAME as string,
    process.env.BLOB_STORAGE_ACCESS_KEY as string
  )

  const storageAccount = `https://${
    process.env.BLOB_STORAGE_ACCOUNT_NAME as string
  }.blob.core.windows.net`

  // if nonexistent, create a container for the user on blob storage
  const client = new BlobServiceClient(storageAccount, sharedKeyCredential)
  const containerClient = client.getContainerClient(ctx.user.sub)
  if (!(await containerClient.exists())) {
    client.createContainer(ctx.user.sub, {
      access: 'blob',
    })
  }

  const fileExtension = FILE_EXTENSIONS[contentType]

  const id = randomUUID()
  const blobName = `${id}.${fileExtension}`
  const fileHref = `${storageAccount}/${ctx.user.sub}/${blobName}`

  // generate file upload SAS with blob storage service
  const permissions = BlobSASPermissions.parse('w')
  const startDate = dayjs()
  const expiryDate = startDate.add(15, 'minutes')
  const queryParams = generateBlobSASQueryParameters(
    {
      containerName: ctx.user.sub,
      permissions: permissions,
      expiresOn: expiryDate.toDate(),
      blobName,
      contentType,
    },
    sharedKeyCredential
  )

  await ctx.prisma.mediaFile.create({
    data: {
      id,
      ownerId: ctx.user.sub,
      type: contentType,
      name: fileName,
      href: fileHref,
    },
  })

  return {
    uploadSasURL: `${storageAccount}?${queryParams}`,
    uploadHref: fileHref,
    containerName: ctx.user.sub,
    fileName: blobName,
  }
}

export async function updateElementInstances(
  { elementId }: { elementId: number },
  ctx: ContextWithUser
) {
  // fetch the question and return null, if the question does not exist
  const element = await ctx.prisma.element.findUnique({
    where: {
      id: elementId,
    },
    include: {
      elementInstances: {
        include: {
          elementStack: {
            include: {
              microLearning: {
                where: {
                  status: {
                    in: [
                      DB.PublicationStatus.DRAFT,
                      DB.PublicationStatus.SCHEDULED,
                    ],
                  },
                },
              },
              practiceQuiz: {
                where: {
                  status: {
                    in: [
                      DB.PublicationStatus.DRAFT,
                      DB.PublicationStatus.SCHEDULED,
                    ],
                  },
                },
              },
            },
          },
          elementBlock: {
            include: {
              // ? where clause is not accepted by prisma for unknown reasons
              liveQuiz: true,
            },
          },
        },
      },
    },
  })

  if (!element) {
    return []
  }

  // get all instances and the corresponding element multipliers
  const instanceData: {
    instanceId: number
    multiplier: number
    maxBonusPoints: number | undefined
    timeToZeroBonus: number | undefined
    liveQuizId: string | undefined
    practiceQuizId: string | undefined
    microLearningId: string | undefined
  }[] = element.elementInstances.reduce<
    {
      instanceId: number
      multiplier: number
      maxBonusPoints: number | undefined
      timeToZeroBonus: number | undefined
      liveQuizId: string | undefined
      practiceQuizId: string | undefined
      microLearningId: string | undefined
    }[]
  >((acc, instance) => {
    if (
      instance.elementBlock?.liveQuiz?.status === DB.PublicationStatus.DRAFT ||
      instance.elementBlock?.liveQuiz?.status === DB.PublicationStatus.SCHEDULED
    ) {
      return [
        ...acc,
        {
          instanceId: instance.id,
          multiplier: instance.elementBlock.liveQuiz.pointsMultiplier,
          maxBonusPoints: undefined,
          timeToZeroBonus: undefined,
          liveQuizId: instance.elementBlock.liveQuiz.id,
          practiceQuizId: undefined,
          microLearningId: undefined,
        },
      ]
    } else if (
      instance.elementStack?.microLearning?.status ===
        DB.PublicationStatus.DRAFT ||
      instance.elementStack?.microLearning?.status ===
        DB.PublicationStatus.SCHEDULED
    ) {
      return [
        ...acc,
        {
          instanceId: instance.id,
          multiplier: instance.elementStack.microLearning.pointsMultiplier,
          maxBonusPoints: undefined,
          timeToZeroBonus: undefined,
          liveQuizId: undefined,
          practiceQuizId: undefined,
          microLearningId: instance.elementStack.microLearning.id,
        },
      ]
    } else if (
      instance.elementStack?.practiceQuiz?.status ===
        DB.PublicationStatus.DRAFT ||
      instance.elementStack?.practiceQuiz?.status ===
        DB.PublicationStatus.SCHEDULED
    ) {
      return [
        ...acc,
        {
          instanceId: instance.id,
          multiplier: instance.elementStack.practiceQuiz.pointsMultiplier,
          maxBonusPoints: undefined,
          timeToZeroBonus: undefined,
          liveQuizId: undefined,
          practiceQuizId: instance.elementStack.practiceQuiz.id,
          microLearningId: undefined,
        },
      ]
    }

    return acc
  }, [])

  const updatedInstances = (
    await Promise.allSettled(
      Object.values(instanceData).map(
        async ({
          instanceId,
          multiplier,
          maxBonusPoints,
          timeToZeroBonus,
          liveQuizId,
          practiceQuizId,
          microLearningId,
        }) => {
          const oldInstance = await ctx.prisma.elementInstance.findUnique({
            where: { id: instanceId },
          })

          if (!oldInstance) return null

          // prepare new element data objects
          const newElementData = processElementData(element)

          // prepare new results objects
          const newResults = getInitialElementResults(element)

          const instance = await ctx.prisma.elementInstance.update({
            where: { id: instanceId },
            data: {
              elementData: newElementData,
              results: newResults,
              anonymousResults: newResults,
              options: {
                ...oldInstance.options,
                pointsMultiplier: multiplier * element.pointsMultiplier,
              },
            },
          })

          if (!instance) return null

          if (typeof liveQuizId !== 'undefined') {
            ctx.emitter.emit('invalidate', {
              typename: 'LiveQuiz',
              id: liveQuizId,
            })
          } else if (typeof practiceQuizId !== 'undefined') {
            ctx.emitter.emit('invalidate', {
              typename: 'PracticeQuiz',
              id: practiceQuizId,
            })
          } else if (typeof microLearningId !== 'undefined') {
            ctx.emitter.emit('invalidate', {
              typename: 'MicroLearning',
              id: microLearningId,
            })
          }

          return instance
        }
      )
    )
  ).flatMap((result) => {
    if (result.status !== 'fulfilled' || !result.value) return []
    return result.value
  })

  return updatedInstances
}
