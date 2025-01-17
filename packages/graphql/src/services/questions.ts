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

// TODO: extract validation and helper functions to separate file?!
function validateSharedChoicesFields(options?: QuestionOptionsArgs | null) {
  // options and choices therein need to be defined
  if (!options || !options.choices) {
    console.error('Options are required on choices questions')
    return false
  }

  // at least one choice needs to be defined
  if (options.choices.length === 0) {
    console.error('At least one choice is required')
    return false
  }

  // every choice needs to have a valid ix (number) and value (string) that is non-empty
  if (
    !options.choices.every(
      (choice) =>
        typeof choice.ix === 'number' &&
        typeof choice.value === 'string' &&
        !choice.value.match(/^(<br>(\n)*)$/g) &&
        choice.value !== ''
    )
  ) {
    console.error('Every choice needs to have a valid ix and value')
    return false
  }

  // displaymode needs to be defined and valid
  if (
    typeof options.displayMode === 'undefined' ||
    options.displayMode === null ||
    !Object.values(DisplayMode).includes(options.displayMode)
  ) {
    console.error(
      'Display mode is required for choices questions and needs to be valid'
    )
    return false
  }

  // sample solution and answer feedback flags need to be set
  if (
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null ||
    typeof options.hasAnswerFeedbacks !== 'boolean' ||
    options.hasAnswerFeedbacks === null
  ) {
    console.error('Sample solution and answer feedback flags are required')
    return false
  }

  // if sample solution is enabled, every option needs to be correct or incorrect
  if (
    options.hasSampleSolution &&
    !options.choices.every((choice) => typeof choice.correct === 'boolean')
  ) {
    console.error(
      'Every choice needs to have a correct flag if sample solution is enabled'
    )
    return false
  }

  // if sample solution and answer feedbacks are enabled, every option needs to have a valid answer feedback
  if (
    options.hasSampleSolution &&
    options.hasAnswerFeedbacks &&
    !options.choices.every(
      (choice) =>
        typeof choice.feedback === 'string' &&
        choice.feedback !== '' &&
        !choice.feedback.match(/^(<br>(\n)*)$/g)
    )
  ) {
    console.error(
      'Every choice needs to have a feedback specified if the corresponding flag is set'
    )
    return false
  }

  return true
}

function validateSCOptions(options?: QuestionOptionsArgs | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // SC only: if sample solution is enabled, exactly one correct answer is allowed
  if (options?.hasSampleSolution) {
    const correctAnswers = options.choices!.filter(
      (choice) => choice.correct === true
    )
    if (correctAnswers.length !== 1) {
      console.error(
        'Exactly one correct answer is required for SC questions with sample solution'
      )
      return false
    }
  }

  return true
}

function validateMCOptions(options?: QuestionOptionsArgs | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // MC only: if sample solution is enabled, at least one correct answer is required
  if (options?.hasSampleSolution) {
    const correctAnswers = options.choices!.filter(
      (choice) => choice.correct === true
    )
    if (correctAnswers.length === 0) {
      console.error(
        'At least one correct answer is required for MC questions with sample solution'
      )
      return false
    }
  }

  return true
}

function validateKPRIMOptions(options?: QuestionOptionsArgs | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // KPRIM only: exactly four choice options are required
  if (options!.choices!.length !== 4) {
    console.error('Exactly four choices are required for KPRIM questions')
    return false
  }

  return true
}

function validateNumericalOptions(options?: QuestionOptionsArgs | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for numerical questions'
    )
    return false
  }

  // if sample solution is enabled, check for solution ranges or exact solutions
  if (options.hasSampleSolution) {
    // either solution ranges or exact solutions need to be defined
    if (!options.solutionRanges && !options.exactSolutions) {
      return false
    }

    // if solution ranges are chosen, at least one needs to be defined and valid
    const invalidSolutionRange =
      options.solutionRanges &&
      (options.solutionRanges.length === 0 ||
        ((options.solutionRanges[0]?.min === null ||
          typeof options.solutionRanges[0]?.min === 'undefined') &&
          (options.solutionRanges[0]?.max === null ||
            typeof options.solutionRanges[0]?.max === 'undefined')))

    // if exact solutions are chosen, at least one needs to be defined
    const invalidExactSolutions =
      options.exactSolutions &&
      (options.exactSolutions.length === 0 ||
        options.exactSolutions[0] === null ||
        typeof options.exactSolutions[0] === 'undefined')

    if (invalidSolutionRange && invalidExactSolutions) {
      return false
    }
  }
}

function validateFreeTextOptions(options?: QuestionOptionsArgs | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for free text questions'
    )
    return false
  }

  // if sample solution is enabled, at least one valid solution is required
  if (
    options.hasSampleSolution &&
    (!options.solutions || options.solutions.length === 0)
  ) {
    return false
  }
}

function validateSelectionOptions(options?: QuestionOptionsArgs | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for selection questions'
    )
    return false
  }

  // number of inputs needs to be specified and valid
  if (
    typeof options.numberOfInputs !== 'number' ||
    options.numberOfInputs === null ||
    options.numberOfInputs < 1
  ) {
    console.error('Number of inputs needs to be specified and valid')
    return false
  }

  // answer collection needs to be defined for selection questions
  if (
    typeof options.answerCollection !== 'number' ||
    options.answerCollection === null
  ) {
    console.error(
      'Answer collection needs to be specified for selection questions'
    )
    return false
  }

  // if sample solution is activated, at the numberOfInputs sample solutions need to be defined
  if (
    options.hasSampleSolution &&
    (!options.correctAnswers ||
      options.correctAnswers.length < options.numberOfInputs)
  ) {
    return false
  }
}

function validateAndProcessElementOptions(
  elementType: DB.ElementType,
  options?: QuestionOptionsArgs | null
) {
  switch (elementType) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM: {
      let valid = false
      if (elementType === DB.ElementType.SC) {
        valid = validateSCOptions(options)
      } else if (elementType === DB.ElementType.MC) {
        valid = validateMCOptions(options)
      } else {
        valid = validateKPRIMOptions(options)
      }

      // if options are not valid, abort processing
      if (!valid) return null

      return {
        displayMode: options!.displayMode,
        hasSampleSolution: options!.hasSampleSolution,
        hasAnswerFeedbacks:
          options!.hasSampleSolution && options!.hasAnswerFeedbacks,
        choices: options!.choices!.map((choice) => ({
          ...choice,
          correct: options!.hasSampleSolution ? choice.correct : undefined,
          feedback:
            options!.hasSampleSolution && options!.hasAnswerFeedbacks
              ? choice.feedback
              : undefined,
        })),
      }
    }

    case DB.ElementType.NUMERICAL: {
      // if options are not valid, abort processing
      const valid = validateNumericalOptions(options)
      if (!valid) return null

      return {
        hasSampleSolution: options!.hasSampleSolution,
        unit: options!.unit ?? undefined,
        accuracy: options!.accuracy ?? undefined,
        placeholder: options!.placeholder ?? undefined,
        restrictions: {
          min: options!.restrictions?.min ?? undefined,
          max: options!.restrictions?.max ?? undefined,
        },
        solutionRanges:
          options!.hasSampleSolution && options!.solutionRanges
            ? options!.solutionRanges
            : undefined,
        exactSolutions:
          options!.hasSampleSolution && options!.exactSolutions
            ? options!.exactSolutions
            : undefined,
      }
    }

    case DB.ElementType.FREE_TEXT: {
      // if options are not valid, abort processing
      const valid = validateFreeTextOptions(options)
      if (!valid) return null

      return {
        hasSampleSolution: options!.hasSampleSolution,
        solutions: options!.hasSampleSolution ? options!.solutions : undefined,
        restrictions: {
          maxLength: options!.restrictions?.maxLength ?? undefined,
        },
      }
    }

    case DB.ElementType.SELECTION: {
      // if options are not valid, abort processing
      const valid = validateSelectionOptions(options)
      if (!valid) return null

      return {
        hasSampleSolution: options!.hasSampleSolution,
        numberOfInputs: options!.numberOfInputs,
      }
    }

    default: {
      return {}
    }
  }
}

function validateElementInputs({
  id,
  status,
  type,
  name,
  content,
  explanation,
  pointsMultiplier,
}: Omit<ManipulateQuestionArgs, 'tags' | 'options'>) {
  // validate if required fields are present when creating a new element
  if (typeof id === 'undefined' || id === null) {
    if (!status) {
      console.error('Status is required')
      return false
    }
    if (!type) {
      console.error('Type is required')
      return false
    }
    if (!name || name !== '') {
      console.error('Name is required')
      return false
    }
    if (!content || !content.match(/^(<br>(\n)*)$/g) || content !== '') {
      console.error('Content is required')
      return false
    }
    if (
      type === DB.ElementType.FLASHCARD &&
      (!explanation ||
        !explanation.match(/^(<br>(\n)*)$/g) ||
        explanation !== '')
    ) {
      console.error('Explanation is required for flashcards')
      return false
    }
    if (
      !pointsMultiplier &&
      type !== DB.ElementType.CONTENT &&
      type !== DB.ElementType.FLASHCARD
    ) {
      console.error(
        'Points multiplier is required (except for flashcard and content elements)'
      )
      return false
    }
  }

  // validate enum values
  if (status && !Object.values(DB.ElementStatus).includes(status)) {
    console.error('Invalid status')
    return false
  }
  if (!Object.values(DB.ElementType).includes(type)) {
    console.error('Invalid type')
    return false
  }

  // validate types of inputs (if they are defined in edit mode and generally in creation mode)
  if (name && typeof name !== 'string') {
    console.error('Name must be a string')
    return false
  }
  if (content && typeof content !== 'string') {
    console.error('Content must be a string')
    return false
  }
  if (explanation && typeof explanation !== 'string') {
    console.error('Explanation must be a string')
    return false
  }
  if (pointsMultiplier && typeof pointsMultiplier !== 'number') {
    console.error('Points multiplier must be a number')
    return false
  }

  return true
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
      answerCollectionSolutions: true,
    },
  })

  if (!question) {
    return null
  }

  return {
    ...question,
    options: {
      ...question.options,
      answerCollection: { id: question.answerCollectionId, entries: [] },
      answerCollectionSolutionIds: question.answerCollectionSolutions.map(
        (sol) => sol.id
      ),
    },
  }
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
    include: {
      answerCollection: {
        include: {
          entries: true,
        },
      },
      answerCollectionSolutions: true,
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
  unit?: string | null // NR only
  accuracy?: number | null // NR only
  placeholder?: string | null // NR/FT only
  restrictions?: {
    maxLength?: number | null // FT only
    minLength?: number | null // unused
    pattern?: string | null // unused
    min?: number | null // NR only
    max?: number | null // NR only
  } | null
  feedback?: string | null // unused
  solutionRanges?: { min?: number | null; max?: number | null }[] | null // NR only
  exactSolutions?: number[] | null // NR only
  solutions?: string[] | null // FT only
  choices?: // SC, MC, KPRIM only
  | {
        ix: number
        value: string
        correct?: boolean | null
        feedback?: string | null
      }[]
    | null
  displayMode?: DisplayMode | null // SC, MC, KPRIM only
  numberOfInputs?: number | null // SE only
  answerCollection?: number | null // SE only
  correctAnswers?: number[] | null // SE only
  hasSampleSolution?: boolean | null // Questions only
  hasAnswerFeedbacks?: boolean | null // SC, MC, KPRIM only
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
  let tagsToDisconnect: string[] = []
  let collectionAnswersToDisconnect: number[] = []

  // validate if all required fields and options are specified
  const validInputs = validateElementInputs({
    id,
    status,
    type,
    name,
    content,
    explanation,
    pointsMultiplier,
  })

  const processedOptions = validateAndProcessElementOptions(type, options)

  // if the provided information is not valid for the element creation / editing, return null
  if (!validInputs || processedOptions === null) {
    return null
  }

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
            answerCollectionSolutions: true,
          },
        })
      : undefined

  // determine which tags have been deconnected
  if (questionPrev?.tags) {
    tagsToDisconnect = questionPrev.tags
      .filter((tag) => !tags?.includes(tag.name))
      .map((tag) => tag.name)
  }

  // determine which answer options are no longer considered to be correct
  if (
    type === DB.ElementType.SELECTION &&
    questionPrev?.answerCollectionSolutions
  ) {
    const prevSolutionsIds = questionPrev.answerCollectionSolutions.map(
      (sol) => sol.id
    )
    collectionAnswersToDisconnect = options?.hasSampleSolution
      ? prevSolutionsIds.filter((sol) => !options.correctAnswers?.includes(sol))
      : prevSolutionsIds
  }

  const question = await ctx.prisma.element.upsert({
    where: {
      id: typeof id !== 'undefined' && id !== null ? id : -1,
    },
    create: {
      status: status!,
      type,
      name: name!,
      content: content!,
      explanation: explanation ?? undefined,
      pointsMultiplier: pointsMultiplier!,
      options: processedOptions,
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
      // connect the selection question to the corresponding answer collection
      answerCollection:
        type === DB.ElementType.SELECTION
          ? {
              connect: {
                id: options!.answerCollection!,
              },
            }
          : undefined,
      // connect the answer collection options to the selection question if sample solution is enabled
      answerCollectionSolutions:
        type === DB.ElementType.SELECTION && options?.hasSampleSolution
          ? {
              connect: options.correctAnswers!.map((id) => ({ id })),
            }
          : undefined,
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
      options: options ? processedOptions : undefined,
      // connect or create new tags and disconnect previous ones if they are selected anymore
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
        disconnect: tagsToDisconnect.map((tag) => {
          return {
            ownerId_name: {
              ownerId: ctx.user.sub,
              name: tag,
            },
          }
        }),
      },
      // connect new answer collection and disconnect previous one if they are not the same
      answerCollection:
        type === DB.ElementType.SELECTION
          ? {
              connect: {
                id: options!.answerCollection!,
              },
            }
          : undefined,
      // connect or disconnect the answer collection options if sample solution is enabled
      answerCollectionSolutions:
        type === DB.ElementType.SELECTION
          ? {
              connect: options?.hasSampleSolution
                ? options.correctAnswers!.map((id) => ({ id }))
                : undefined,
              disconnect: collectionAnswersToDisconnect.map((id) => ({ id })),
            }
          : undefined,
    },
    include: {
      tags: {
        orderBy: {
          order: 'asc',
        },
      },
      answerCollectionSolutions: true,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: question.id,
  })

  if (
    type === DB.ElementType.SELECTION &&
    typeof options?.answerCollection !== 'undefined'
  ) {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: options.answerCollection,
    })
  }

  return {
    ...question,
    options: {
      ...question.options,
      answerCollection: { id: question.answerCollectionId, entries: [] },
      answerCollectionSolutionIds: question.answerCollectionSolutions.map(
        (sol) => sol.id
      ),
    },
  }
}

export async function deleteQuestion(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // soft delete question and disconnect linked answer collection and sample solutions
  const question = await ctx.prisma.element.update({
    where: {
      id: id,
      ownerId: ctx.user.sub,
    },
    data: {
      isDeleted: true,
      answerCollection: {
        disconnect: true,
      },
      answerCollectionSolutions: {
        set: [],
      },
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

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: question.id,
  })

  // if answer collection was connected, invalidate it
  if (question.answerCollectionId) {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: question.answerCollectionId,
    })
  }

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
      answerCollection: {
        include: {
          entries: true,
        },
      },
      answerCollectionSolutions: true,
    },
  })

  if (!element) {
    return []
  }

  // get all instances and the corresponding element multipliers
  const instanceData: {
    instanceId: number
    multiplier: number
    liveQuizId: string | undefined
    practiceQuizId: string | undefined
    microLearningId: string | undefined
  }[] = element.elementInstances.reduce<
    {
      instanceId: number
      multiplier: number
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
          liveQuizId: instance.elementBlock.liveQuizId,
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
              // keep previous options where possible and update them only where required
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
