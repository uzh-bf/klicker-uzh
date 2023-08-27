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
import { Question, Tag } from 'src/ops'
import { ContextWithUser } from '../lib/context'

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
  const question = await ctx.prisma.question.findUnique({
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
    questionData: question,
  }
}

export async function manipulateQuestion(
  {
    id,
    type,
    name,
    content,
    explanation,
    options,
    hasSampleSolution,
    hasAnswerFeedbacks,
    pointsMultiplier,
    tags,
    displayMode,
  }: {
    id?: number | null
    type: DB.QuestionType
    name?: string | null
    content?: string | null
    explanation?: string | null
    options?: {
      unit?: string | null
      accuracy?: number | null
      placeholder?: string | null
      restrictions?: {
        maxLength?: number | null
        minLength?: number | null
        pattern?: string | null
        min?: number | null
        max?: number | null
      }
      feedback?: string
      solutionRanges?: { min?: number; max?: number }[]
      solutions?: string[]
      choices?: {
        ix: number
        value: string
        correct?: boolean
        feedback?: string
      }[]
    } | null
    hasSampleSolution?: boolean | null
    hasAnswerFeedbacks?: boolean | null
    pointsMultiplier?: number | null
    tags?: string[] | null
    displayMode?: DB.QuestionDisplayMode | null
  },
  ctx: ContextWithUser
) {
  let tagsToDelete: string[] = []

  const questionPrev =
    typeof id !== 'undefined' && id !== null
      ? await ctx.prisma.question.findUnique({
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

  const question = await ctx.prisma.question.upsert({
    where: {
      id: typeof id !== 'undefined' && id !== null ? id : -1,
    },
    create: {
      type: type,
      name: name ?? 'Missing Question Title',
      content: content ?? 'Missing Question Content',
      explanation: explanation ?? undefined,
      hasSampleSolution: hasSampleSolution ?? false,
      hasAnswerFeedbacks: hasAnswerFeedbacks ?? false,
      pointsMultiplier: pointsMultiplier ?? 1,
      displayMode: displayMode ?? undefined,
      options: options || {},
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
      hasSampleSolution: hasSampleSolution ?? false,
      hasAnswerFeedbacks: hasAnswerFeedbacks ?? false,
      pointsMultiplier: pointsMultiplier ?? 1,
      options: options ?? undefined,
      displayMode: displayMode ?? undefined,
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
    typename: 'Question',
    id: question.id,
  })

  return {
    ...question,
    questionData: question,
  }
}

export async function deleteQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const question = await ctx.prisma.question.update({
    where: {
      id: id,
      ownerId: ctx.user.sub,
    },
    data: {
      isDeleted: true,
    },
  })

  // TODO: Once migration deadline is over, rework approach and delete question for real
  // const question = await ctx.prisma.question.delete({
  //   where: {
  //     id: id,
  //     ownerId: ctx.user.sub,
  //   },
  // })

  // ctx.emitter.emit('invalidate', {
  //   typename: 'Question',
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
): Promise<Partial<Question>[]> {
  await ctx.prisma.question.updateMany({
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
