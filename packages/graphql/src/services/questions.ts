import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma'
import { randomUUID } from 'crypto'
import dayjs from 'dayjs'
import * as R from 'ramda'
import { Tag } from 'src/ops'
import { DisplayMode } from 'src/types/app'
import { ContextWithUser } from '../lib/context'
import {
  prepareInitialInstanceResults,
  processQuestionData,
} from '../lib/questions'

export async function getUserQuestions(ctx: ContextWithUser) {
  const userQuestions = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      questions: {
        where: {
          isDeleted: false,
          type: {
            in: [
              DB.ElementType.SC,
              DB.ElementType.MC,
              DB.ElementType.KPRIM,
              DB.ElementType.FREE_TEXT,
              DB.ElementType.NUMERICAL,
            ],
          },
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

  if (!question) return null

  return {
    ...question,
    questionData: {
      ...question,
      id: `${question.id}-v${question.version}`,
      questionId: question.id,
    },
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
  solutions?: string[] | null
  choices?:
    | {
        ix: number
        value: string
        correct?: boolean | null
        feedback?: string | null
      }[]
    | null
  displayMode?: DB.ElementDisplayMode | null
  hasSampleSolution?: boolean | null
  hasAnswerFeedbacks?: boolean | null
  pointsMultiplier?: number | null
}

interface ManipulateQuestionArgs {
  id?: number | null
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
      type: type,
      name: name ?? 'Missing Question Title',
      content: content ?? 'Missing Question Content',
      explanation: explanation ?? undefined,
      pointsMultiplier: pointsMultiplier ?? 1,
      options: {
        ...options,
        displayMode: options?.displayMode ?? DisplayMode.LIST,
        hasSampleSolution: options?.hasSampleSolution ?? false,
        hasAnswerFeedbacks: options?.hasAnswerFeedbacks ?? false,
        accuracy: options?.accuracy ?? undefined,
        placeholder: options?.placeholder ?? undefined,
        restrictions: {
          ...options?.restrictions,
          min: options?.restrictions?.min ?? undefined,
          max: options?.restrictions?.max ?? undefined,
        },
        solutionRanges: options?.solutionRanges ?? undefined,
        solutions: options?.solutions ?? undefined,
      },
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
      name: name ?? undefined,
      content: content ?? undefined,
      explanation: explanation ?? undefined,
      pointsMultiplier: pointsMultiplier ?? 1,
      version: {
        increment: 1,
      },
      options: options
        ? {
            ...options,
            displayMode: options?.displayMode ?? DisplayMode.LIST,
            hasSampleSolution: options?.hasSampleSolution ?? false,
            hasAnswerFeedbacks: options?.hasAnswerFeedbacks ?? false,
            accuracy: options?.accuracy ?? undefined,
            placeholder: options?.placeholder ?? undefined,
            restrictions: {
              ...options?.restrictions,
              min: options?.restrictions?.min ?? undefined,
              max: options?.restrictions?.max ?? undefined,
            },
            solutionRanges: options?.solutionRanges ?? undefined,
            solutions: options?.solutions ?? undefined,
          }
        : undefined,
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

  // TODO: fix invalidation of cache
  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: question.id,
  })

  return {
    ...question,
    questionData: {
      ...question,
      id: `${question.id}-v${question.version}`,
      questionId: question.id,
    },
  }
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

  const sortedTags = R.sortWith<Tag>(
    [R.ascend(R.prop('order')), R.ascend(R.prop('name'))],
    tags
  )

  const reorderedTags = R.swap<Tag>(originIx, targetIx, sortedTags)

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

export async function updateQuestionInstances(
  { questionId }: { questionId: number },
  ctx: ContextWithUser
) {
  // fetch the question and return null, if the question does not exist
  const question = await ctx.prisma.element.findUnique({
    where: {
      id: questionId,
    },
    include: {
      instances: {
        include: {
          sessionBlock: {
            include: {
              session: true,
            },
          },
          stackElement: {
            include: {
              stack: {
                include: {
                  learningElement: {
                    where: {
                      status: DB.LearningElementStatus.DRAFT,
                    },
                  },
                },
              },
            },
          },
          microSession: {
            where: {
              status: DB.MicroSessionStatus.DRAFT,
            },
          },
        },
      },
    },
  })

  if (!question) {
    return null
  }

  // get all instances and the corresponding element multipliers
  const instanceData: {
    instanceId: number
    multiplier: number
    sessionId: string | undefined
    practiceQuizId: string | undefined
    microlearningId: string | undefined
  }[] = {
    ...question.instances.reduce<
      {
        instanceId: number
        multiplier: number
        sessionId: string | undefined
        practiceQuizId: string | undefined
        microlearningId: string | undefined
      }[]
    >((acc, instance) => {
      if (
        instance.sessionBlock?.session?.status === DB.SessionStatus.PREPARED ||
        instance.sessionBlock?.session?.status === DB.SessionStatus.SCHEDULED
      ) {
        return [
          ...acc,
          {
            instanceId: instance.id,
            multiplier: instance.sessionBlock.session.pointsMultiplier,
            sessionId: instance.sessionBlock.session.id,
            practiceQuizId: undefined,
            microlearningId: undefined,
          },
        ]
      } else if (
        instance.stackElement?.stack?.learningElement?.status ===
        DB.LearningElementStatus.DRAFT
      ) {
        return [
          ...acc,
          {
            instanceId: instance.id,
            multiplier:
              instance.stackElement.stack.learningElement.pointsMultiplier,
            sessionId: undefined,
            practiceQuizId: instance.stackElement.stack.learningElement.id,
            microlearningId: undefined,
          },
        ]
      } else if (
        instance.microSession?.status === DB.MicroSessionStatus.DRAFT
      ) {
        return [
          ...acc,
          {
            instanceId: instance.id,
            multiplier: instance.microSession.pointsMultiplier,
            sessionId: undefined,
            practiceQuizId: undefined,
            microlearningId: instance.microSession.id,
          },
        ]
      }
      return acc
    }, []),
  }

  console.log(instanceData)

  // prepare new question objects
  const newQuestionData = processQuestionData(question)

  // prepare new results objects
  const newResults = prepareInitialInstanceResults(newQuestionData)

  const updatedInstances = (
    await Promise.allSettled(
      Object.values(instanceData).map(
        async ({
          instanceId,
          multiplier,
          sessionId,
          practiceQuizId,
          microlearningId,
        }) => {
          const instance = await ctx.prisma.questionInstance.update({
            where: { id: instanceId },
            data: {
              questionData: newQuestionData,
              results: newResults,
              pointsMultiplier: multiplier * question.pointsMultiplier,
            },
          })

          if (!instance) return null

          // invalidate cache for the corresponding element
          if (typeof sessionId !== 'undefined') {
            ctx.emitter.emit('invalidate', {
              typename: 'Session',
              id: sessionId,
            })
          } else if (typeof practiceQuizId !== 'undefined') {
            ctx.emitter.emit('invalidate', {
              typename: 'LearningElement',
              id: practiceQuizId,
            })
          } else if (typeof microlearningId !== 'undefined') {
            ctx.emitter.emit('invalidate', {
              typename: 'MicroSession',
              id: microlearningId,
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
