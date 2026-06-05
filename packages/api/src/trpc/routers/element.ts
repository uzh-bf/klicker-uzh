import {
  ActivityLogType,
  ElementStatus,
  ElementType,
  ObjectType,
  PermissionLevel,
  PublicationStatus,
  ReviewStatus,
  type ElementInstance,
} from '@klicker-uzh/prisma/client'
import {
  ActivityLogModificationFieldType,
  ActivityType,
  type ActivityLogModificationDetails,
  type ElementManipulationInput,
  type ElementOptionsInput,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'
import { getPrisma, type TRPCContext } from '../context.js'
import { router } from '../init.js'
import { hasObjectPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  changeElementStatusInput,
  editTagInput,
  elementIdInput,
  flagOutdatedElementInstancesInput,
  manipulateCaseStudyElementInput,
  manipulateChoicesElementInput,
  manipulateContentElementInput,
  manipulateFlashcardElementInput,
  manipulateFreeTextElementInput,
  manipulateNumericalElementInput,
  manipulateSelectionElementInput,
  tagOrderingInput,
  updateElementInstancesInput,
} from '../schemas/element.js'

type TagRecord = {
  id: number
  name: string
  order: number
}

function toTagDto(tag: TagRecord) {
  return {
    id: tag.id,
    name: tag.name,
    order: tag.order,
  }
}

function reorderTags<T>(tags: T[], originIx: number, targetIx: number) {
  const reorderedTags = [...tags]

  if (
    originIx < 0 ||
    targetIx < 0 ||
    originIx >= reorderedTags.length ||
    targetIx >= reorderedTags.length
  ) {
    return reorderedTags
  }

  const originTag = reorderedTags[originIx]!
  reorderedTags[originIx] = reorderedTags[targetIx]!
  reorderedTags[targetIx] = originTag

  return reorderedTags
}

async function hasElementAdminPermission({
  ctx,
  id,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  id: number
}) {
  return hasElementPermission({
    ctx,
    id,
    permissionLevel: PermissionLevel.ADMIN,
  })
}

async function hasElementPermission({
  ctx,
  id,
  permissionLevel,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  id: number
  permissionLevel: PermissionLevel
}) {
  return hasObjectPermission(
    ctx,
    { objectId: String(id), objectType: ObjectType.ELEMENT },
    permissionLevel
  )
}

type EditElementRecord = {
  id: number
  version: number
  name: string
  status: ElementStatus
  type: ElementType
  content: string
  explanation?: string | null
  basePoints: boolean
  pointsMultiplier: number
  options?: unknown
  tags?: TagRecord[] | null
  answerCollectionId?: number | null
  answerCollectionItems?: { id: number }[] | null
  permissionLevel?: PermissionLevel
  derivedAccess?: boolean
  isOwner?: boolean
  isManager?: boolean
  isEditor?: boolean
}

function getElementTypename(type: ElementType) {
  switch (type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      return 'ChoicesElement'
    case ElementType.NUMERICAL:
      return 'NumericalElement'
    case ElementType.FREE_TEXT:
      return 'FreeTextElement'
    case ElementType.SELECTION:
      return 'SelectionElement'
    case ElementType.CASE_STUDY:
      return 'CaseStudyElement'
    case ElementType.FLASHCARD:
      return 'FlashcardElement'
    case ElementType.CONTENT:
      return 'ContentElement'
  }
}

function asElementOptions(options: unknown) {
  return options && typeof options === 'object'
    ? (options as Record<string, any>)
    : {}
}

function toEditElementDto(element: EditElementRecord) {
  const options = asElementOptions(element.options)
  const selectedItemIds =
    element.answerCollectionItems?.map((item) => item.id) ?? []
  const baseElement = {
    __typename: getElementTypename(element.type),
    id: element.id,
    version: element.version,
    name: element.name,
    status: element.status,
    type: element.type,
    content: element.content,
    explanation: element.explanation ?? null,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
    isOwner: element.isOwner,
    isManager: element.isManager,
    isEditor: element.isEditor,
    tags: element.tags?.map(toTagDto) ?? [],
  }

  if (
    element.type === ElementType.SC ||
    element.type === ElementType.MC ||
    element.type === ElementType.KPRIM
  ) {
    return {
      ...baseElement,
      __typename: 'ChoicesElement' as const,
      options: {
        __typename: 'ChoiceElementOptions' as const,
        hasSampleSolution: options.hasSampleSolution ?? false,
        hasAnswerFeedbacks: options.hasAnswerFeedbacks ?? false,
        displayMode: options.displayMode,
        choices: options.choices ?? [],
      },
    }
  }

  if (element.type === ElementType.NUMERICAL) {
    return {
      ...baseElement,
      __typename: 'NumericalElement' as const,
      options: {
        __typename: 'NumericalElementOptions' as const,
        hasSampleSolution: options.hasSampleSolution ?? false,
        accuracy: options.accuracy ?? null,
        placeholder: options.placeholder ?? null,
        unit: options.unit ?? null,
        restrictions: options.restrictions ?? null,
        solutionRanges: options.solutionRanges ?? null,
        exactSolutions: options.exactSolutions ?? null,
      },
    }
  }

  if (element.type === ElementType.FREE_TEXT) {
    return {
      ...baseElement,
      __typename: 'FreeTextElement' as const,
      options: {
        __typename: 'FreeTextElementOptions' as const,
        hasSampleSolution: options.hasSampleSolution ?? false,
        restrictions: options.restrictions ?? null,
        solutions: options.solutions ?? null,
      },
    }
  }

  if (element.type === ElementType.SELECTION) {
    const optionAnswerCollection = asElementOptions(options.answerCollection)
    const answerCollectionId =
      typeof optionAnswerCollection.id === 'number'
        ? optionAnswerCollection.id
        : element.answerCollectionId

    return {
      ...baseElement,
      __typename: 'SelectionElement' as const,
      options: {
        __typename: 'SelectionElementOptions' as const,
        hasSampleSolution: options.hasSampleSolution ?? false,
        numberOfInputs: options.numberOfInputs ?? null,
        answerCollection:
          typeof answerCollectionId === 'number'
            ? {
                __typename: 'ElementOptionsAnswerCollection' as const,
                id: answerCollectionId,
                entries: optionAnswerCollection.entries ?? [],
              }
            : null,
        answerCollectionSolutionIds:
          options.answerCollectionSolutionIds ?? selectedItemIds,
      },
    }
  }

  if (element.type === ElementType.CASE_STUDY) {
    return {
      ...baseElement,
      __typename: 'CaseStudyElement' as const,
      options: {
        __typename: 'CaseStudyElementOptions' as const,
        hasSampleSolution: options.hasSampleSolution ?? false,
        answerCollectionId:
          options.answerCollectionId ?? element.answerCollectionId,
        collectionItemIds: options.collectionItemIds ?? selectedItemIds,
        criteria: options.criteria ?? [],
        cases: options.cases ?? [],
      },
    }
  }

  if (element.type === ElementType.FLASHCARD) {
    return {
      ...baseElement,
      __typename: 'FlashcardElement' as const,
    }
  }

  return {
    ...baseElement,
    __typename: 'ContentElement' as const,
  }
}

async function getSingleElementForEdit({
  ctx,
  id,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  id: number
}) {
  const prisma = getPrisma(ctx)
  const element = await prisma.element.findUnique({
    where: { id, permissions: { some: { userId: ctx.user.sub } } },
    include: {
      permissions: {
        where: { userId: ctx.user.sub },
      },
      tags: {
        where: { ownerId: ctx.user.sub },
        orderBy: { order: 'asc' },
      },
      answerCollectionItems: true,
    },
  })

  if (!element) return null

  const permission = element.permissions[0]
  if (!permission) return null

  return toEditElementDto({
    ...element,
    permissionLevel: permission.permissionLevel,
    derivedAccess: permission.derived,
    isOwner: permission.permissionLevel === PermissionLevel.OWNER,
    isManager:
      permission.permissionLevel === PermissionLevel.OWNER ||
      permission.permissionLevel === PermissionLevel.ADMIN,
    isEditor:
      permission.permissionLevel === PermissionLevel.OWNER ||
      permission.permissionLevel === PermissionLevel.ADMIN ||
      permission.permissionLevel === PermissionLevel.WRITE,
    options: {
      ...asElementOptions(element.options),
      answerCollection: { id: element.answerCollectionId, entries: [] },
      answerCollectionSolutionIds: element.answerCollectionItems.map(
        (item) => item.id
      ),
      answerCollectionId: element.answerCollectionId,
      collectionItemIds: element.answerCollectionItems.map((item) => item.id),
    },
  })
}

function isBlankElementText(value?: string | null) {
  return !value || value.match(/^(<br>(\n)*)$/g) || value === ''
}

function validateElementInputs({
  id,
  status,
  type,
  name,
  content,
  explanation,
  basePoints,
  pointsMultiplier,
}: Omit<ElementManipulationInput, 'tags' | 'options'>) {
  if (typeof id === 'undefined' || id === null) {
    if (!status) return false
    if (!type) return false
    if (!name || name === '') return false
    if (isBlankElementText(content)) return false
    if (type === ElementType.FLASHCARD && isBlankElementText(explanation)) {
      return false
    }
    if (
      typeof basePoints !== 'boolean' &&
      type !== ElementType.CONTENT &&
      type !== ElementType.FLASHCARD
    ) {
      return false
    }
    if (
      !pointsMultiplier &&
      type !== ElementType.CONTENT &&
      type !== ElementType.FLASHCARD
    ) {
      return false
    }
  }

  if (status && !Object.values(ElementStatus).includes(status)) return false
  if (!Object.values(ElementType).includes(type)) return false
  if (
    typeof name !== 'undefined' &&
    name !== null &&
    (typeof name !== 'string' || name === '')
  ) {
    return false
  }
  if (
    typeof content !== 'undefined' &&
    content !== null &&
    isBlankElementText(content)
  ) {
    return false
  }
  if (
    typeof explanation !== 'undefined' &&
    explanation !== null &&
    type === ElementType.FLASHCARD &&
    isBlankElementText(explanation)
  ) {
    return false
  }
  if (
    typeof pointsMultiplier !== 'undefined' &&
    pointsMultiplier !== null &&
    (typeof pointsMultiplier !== 'number' || pointsMultiplier <= 0)
  ) {
    return false
  }

  return true
}

function validateAndProcessElementOptions(
  elementType: ElementType,
  options?: ElementOptionsInput | null
) {
  if (
    elementType === ElementType.CONTENT ||
    elementType === ElementType.FLASHCARD
  ) {
    return {}
  }

  if (!options) return null

  if (
    elementType === ElementType.SC ||
    elementType === ElementType.MC ||
    elementType === ElementType.KPRIM
  ) {
    if (!options.displayMode || !options.choices?.length) return null

    return {
      displayMode: options.displayMode,
      hasSampleSolution: options.hasSampleSolution,
      hasAnswerFeedbacks:
        options.hasSampleSolution && options.hasAnswerFeedbacks,
      choices: options.choices.map((choice) => ({
        ...choice,
        correct: options.hasSampleSolution ? choice.correct : undefined,
        feedback:
          options.hasSampleSolution && options.hasAnswerFeedbacks
            ? choice.feedback
            : undefined,
      })),
    }
  }

  if (elementType === ElementType.NUMERICAL) {
    return {
      hasSampleSolution: options.hasSampleSolution,
      unit: options.unit ?? undefined,
      accuracy: options.accuracy ?? undefined,
      placeholder: options.placeholder ?? undefined,
      restrictions: {
        min: options.restrictions?.min ?? undefined,
        max: options.restrictions?.max ?? undefined,
      },
      solutionRanges:
        options.hasSampleSolution && options.solutionRanges
          ? options.solutionRanges
          : undefined,
      exactSolutions:
        options.hasSampleSolution && options.exactSolutions
          ? options.exactSolutions
          : undefined,
    }
  }

  if (elementType === ElementType.FREE_TEXT) {
    return {
      hasSampleSolution: options.hasSampleSolution,
      solutions: options.hasSampleSolution ? options.solutions : undefined,
      restrictions: {
        maxLength: options.restrictions?.maxLength ?? undefined,
      },
    }
  }

  if (elementType === ElementType.SELECTION) {
    if (!options.answerCollection || !options.numberOfInputs) return null

    return {
      hasSampleSolution: options.hasSampleSolution,
      numberOfInputs: options.numberOfInputs,
    }
  }

  if (elementType === ElementType.CASE_STUDY) {
    if (
      !options.answerCollection ||
      !options.collectionItemIds?.length ||
      !options.criteria?.length ||
      !options.cases?.length
    ) {
      return null
    }

    return {
      hasSampleSolution: options.hasSampleSolution,
      criteria: options.criteria.map((criterion) => ({
        id: criterion.id,
        name: criterion.name,
        order: criterion.order,
        min: criterion.min,
        max: criterion.max,
        step: criterion.step,
        unit: criterion.unit ?? undefined,
        labels: criterion.labels ?? undefined,
      })),
      cases: options.cases.map((caseItem) => ({
        id: caseItem.id,
        title: caseItem.title,
        description: caseItem.description,
        order: caseItem.order,
        solutions: options.hasSampleSolution ? caseItem.solutions : undefined,
      })),
    }
  }

  return {}
}

async function hasAnswerCollectionReadAccess({
  prisma,
  userId,
  answerCollectionId,
}: {
  prisma: PrismaTransactionClient
  userId: string
  answerCollectionId: number
}) {
  const permission = await prisma.derivedPermission.findFirst({
    where: {
      answerCollectionId,
      userId,
      permissionLevel: {
        in: [
          PermissionLevel.READ,
          PermissionLevel.EXECUTE,
          PermissionLevel.WRITE,
          PermissionLevel.ADMIN,
          PermissionLevel.OWNER,
        ],
      },
    },
  })

  return Boolean(permission)
}

async function manipulateElement(
  {
    id,
    status,
    type,
    name,
    content,
    explanation,
    options,
    basePoints,
    pointsMultiplier,
    tags,
  }: ElementManipulationInput,
  ctx: TRPCContext & { user: { sub: string } }
) {
  const prisma = getPrisma(ctx)
  let tagsToDisconnect: string[] = []
  let collectionAnswersToDisconnect: number[] = []

  const validInputs = validateElementInputs({
    id,
    status,
    type,
    name,
    content,
    explanation,
    basePoints,
    pointsMultiplier,
  })
  const processedOptions = validateAndProcessElementOptions(type, options)

  if (!validInputs || processedOptions === null) return null

  const isNewElement = typeof id === 'undefined' || id === null
  const elementPrev = !isNewElement
    ? await prisma.element.findUnique({
        where: { id, isDeleted: false },
        include: {
          tags: { orderBy: { order: 'asc' } },
          answerCollectionItems: true,
        },
      })
    : undefined

  if (elementPrev?.tags) {
    tagsToDisconnect = elementPrev.tags
      .filter((tag) => !tags?.includes(tag.name))
      .map((tag) => tag.name)
  }

  if (
    (type === ElementType.SELECTION || type === ElementType.CASE_STUDY) &&
    options?.answerCollection
  ) {
    const validAccess = await hasAnswerCollectionReadAccess({
      prisma,
      userId: ctx.user.sub,
      answerCollectionId: options.answerCollection,
    })

    if (!validAccess) return null
  }

  if (type === ElementType.SELECTION && elementPrev?.answerCollectionItems) {
    const prevSolutionsIds = elementPrev.answerCollectionItems.map(
      (solution) => solution.id
    )
    collectionAnswersToDisconnect = options?.hasSampleSolution
      ? prevSolutionsIds.filter(
          (solution) => !options.correctAnswers?.includes(solution)
        )
      : prevSolutionsIds
  }

  if (type === ElementType.CASE_STUDY && elementPrev?.answerCollectionItems) {
    const previousItemIds = elementPrev.answerCollectionItems.map(
      (item) => item.id
    )
    collectionAnswersToDisconnect = previousItemIds.filter(
      (item) => !options?.collectionItemIds?.includes(item)
    )
  }

  const element = await prisma.element.upsert({
    where: { id: typeof id !== 'undefined' && id !== null ? id : -1 },
    create: {
      status: status!,
      type,
      name: name!,
      content: content!,
      explanation: explanation ?? undefined,
      basePoints:
        type === ElementType.CONTENT || type === ElementType.FLASHCARD
          ? false
          : basePoints!,
      pointsMultiplier: pointsMultiplier!,
      options: processedOptions,
      owner: { connect: { id: ctx.user.sub } },
      tags: {
        connectOrCreate: tags?.map((tag) => ({
          where: { ownerId_name: { ownerId: ctx.user.sub, name: tag } },
          create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
        })),
      },
      answerCollection:
        type === ElementType.SELECTION || type === ElementType.CASE_STUDY
          ? { connect: { id: options!.answerCollection! } }
          : undefined,
      answerCollectionItems:
        type === ElementType.SELECTION && options!.hasSampleSolution
          ? { connect: options!.correctAnswers!.map((id) => ({ id })) }
          : type === ElementType.CASE_STUDY
            ? { connect: options!.collectionItemIds!.map((id) => ({ id })) }
            : undefined,
    },
    update: {
      status: status ?? undefined,
      name: name ?? undefined,
      content: content ?? undefined,
      explanation: typeof explanation === 'undefined' ? undefined : explanation,
      basePoints:
        type === ElementType.CONTENT || type === ElementType.FLASHCARD
          ? false
          : basePoints!,
      pointsMultiplier: pointsMultiplier ?? 1,
      version: { increment: 1 },
      options: options ? processedOptions : undefined,
      tags: {
        connectOrCreate: tags
          ?.filter((tag) => tag !== '')
          .map((tag) => ({
            where: { ownerId_name: { ownerId: ctx.user.sub, name: tag } },
            create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
          })),
        disconnect: tagsToDisconnect.map((tag) => ({
          ownerId_name: { ownerId: ctx.user.sub, name: tag },
        })),
      },
      answerCollection:
        type === ElementType.SELECTION || type === ElementType.CASE_STUDY
          ? { connect: { id: options!.answerCollection! } }
          : undefined,
      answerCollectionItems:
        type === ElementType.SELECTION || type === ElementType.CASE_STUDY
          ? {
              connect:
                type === ElementType.SELECTION && options?.hasSampleSolution
                  ? options.correctAnswers!.map((id) => ({ id }))
                  : type === ElementType.CASE_STUDY
                    ? options?.collectionItemIds?.map((id) => ({ id }))
                    : undefined,
              disconnect: collectionAnswersToDisconnect.map((id) => ({ id })),
            }
          : undefined,
    },
    include: {
      tags: { orderBy: { order: 'asc' } },
      answerCollectionItems: true,
    },
  })

  await recomputeDerivedPermissions(
    { elementId: element.id, userId: ctx.user.sub },
    prisma
  )

  if (
    elementPrev?.answerCollectionId !== null &&
    typeof elementPrev?.answerCollectionId !== 'undefined' &&
    element.answerCollectionId !== elementPrev.answerCollectionId
  ) {
    await recomputeDerivedPermissions(
      { answerCollectionId: elementPrev.answerCollectionId },
      prisma
    )
  }

  if (isNewElement) {
    await prisma.activityLogEntry.create({
      data: {
        type: ActivityLogType.CREATION,
        objectType: ObjectType.ELEMENT,
        elementId: element.id,
        userId: ctx.user.sub,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt,
      },
    })
  } else if (elementPrev && name && name !== elementPrev.name) {
    const modificationDetails: ActivityLogModificationDetails = {
      field: ActivityLogModificationFieldType.TITLE,
      oldValue: elementPrev.name,
      newValue: name,
    }

    await prisma.activityLogEntry.create({
      data: {
        type: ActivityLogType.MODIFICATION,
        modificationDetails,
        objectType: ObjectType.ELEMENT,
        elementId: element.id,
        userId: ctx.user.sub,
      },
    })
  }

  ctx.emitter?.emit('invalidate', {
    typename: 'Element',
    id: element.id,
  })

  if (
    (type === ElementType.SELECTION || type === ElementType.CASE_STUDY) &&
    typeof options?.answerCollection !== 'undefined'
  ) {
    ctx.emitter?.emit('invalidate', {
      typename: 'AnswerCollection',
      id: options.answerCollection,
    })
  }

  return toEditElementDto({
    ...element,
    options: {
      ...asElementOptions(element.options),
      answerCollection: { id: element.answerCollectionId, entries: [] },
      answerCollectionSolutionIds: element.answerCollectionItems.map(
        (item) => item.id
      ),
      answerCollectionId: element.answerCollectionId,
      collectionItemIds: element.answerCollectionItems.map((item) => item.id),
    },
  })
}

function getElementDataOptions(instance: ElementInstance) {
  const elementData = instance.elementData as { options?: Record<string, any> }
  return elementData.options ?? {}
}

async function getActivityAnswerCollectionIds({
  activityId,
  activityType,
  prisma,
}: {
  activityId: string
  activityType: ActivityType
  prisma: PrismaTransactionClient
}) {
  let instances: ElementInstance[] = []

  if (activityType === ActivityType.LIVE_QUIZ) {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: activityId },
      include: { blocks: { include: { elements: true } } },
    })
    instances = liveQuiz?.blocks.flatMap((block) => block.elements) ?? []
  } else if (activityType === ActivityType.PRACTICE_QUIZ) {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: activityId },
      include: { stacks: { include: { elements: true } } },
    })
    instances = practiceQuiz?.stacks.flatMap((stack) => stack.elements) ?? []
  } else if (activityType === ActivityType.MICRO_LEARNING) {
    const microLearning = await prisma.microLearning.findUnique({
      where: { id: activityId },
      include: { stacks: { include: { elements: true } } },
    })
    instances = microLearning?.stacks.flatMap((stack) => stack.elements) ?? []
  } else if (activityType === ActivityType.GROUP_ACTIVITY) {
    const groupActivity = await prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: { stacks: { include: { elements: true } } },
    })
    instances = groupActivity?.stacks.flatMap((stack) => stack.elements) ?? []
  }

  const answerCollectionIds = Array.from(
    new Set(
      instances.flatMap((instance) => {
        if (instance.elementType === ElementType.SELECTION) {
          const answerCollection = asElementOptions(
            getElementDataOptions(instance).answerCollection
          )
          return typeof answerCollection.id === 'number'
            ? [answerCollection.id]
            : []
        }

        if (instance.elementType === ElementType.CASE_STUDY) {
          const answerCollectionId =
            getElementDataOptions(instance).answerCollectionId
          return typeof answerCollectionId === 'number'
            ? [answerCollectionId]
            : []
        }

        return []
      })
    )
  )

  const answerCollectionEntryIds = Array.from(
    new Set(
      instances.flatMap((instance) => {
        const options = getElementDataOptions(instance)
        if (instance.elementType === ElementType.SELECTION) {
          return Array.isArray(options.answerCollectionSolutionIds)
            ? options.answerCollectionSolutionIds
            : []
        }

        if (instance.elementType === ElementType.CASE_STUDY) {
          return Array.isArray(options.items)
            ? options.items.flatMap((item) =>
                typeof item.id === 'number' ? [item.id] : []
              )
            : []
        }

        return []
      })
    )
  )

  return { answerCollectionIds, answerCollectionEntryIds }
}

async function updateElementInstances({
  elementId,
  includeTemplates,
  prisma,
  emitter,
  userId,
}: {
  elementId: number
  includeTemplates: boolean
  prisma: PrismaTransactionClient
  emitter: TRPCContext['emitter']
  userId: string
}) {
  const acceptedStatusValues = includeTemplates
    ? [
        PublicationStatus.DRAFT,
        PublicationStatus.SCHEDULED,
        PublicationStatus.TEMPLATE,
      ]
    : [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED]
  const requiredActivityAccess: PermissionLevel[] = [
    PermissionLevel.WRITE,
    PermissionLevel.ADMIN,
    PermissionLevel.OWNER,
  ]

  const element = await prisma.element.findUnique({
    where: { id: elementId, isDeleted: false },
    include: {
      elementInstances: {
        include: {
          elementStack: {
            include: {
              microLearning: {
                where: {
                  status: { in: acceptedStatusValues },
                  permissions: {
                    some: {
                      userId,
                      permissionLevel: { in: requiredActivityAccess },
                    },
                  },
                },
                include: { templateInfo: true },
              },
              practiceQuiz: {
                where: {
                  status: { in: acceptedStatusValues },
                  permissions: {
                    some: {
                      userId,
                      permissionLevel: { in: requiredActivityAccess },
                    },
                  },
                },
                include: { templateInfo: true },
              },
              groupActivity: {
                where: {
                  status: { in: acceptedStatusValues },
                  permissions: {
                    some: {
                      userId,
                      permissionLevel: { in: requiredActivityAccess },
                    },
                  },
                },
                include: { templateInfo: true },
              },
            },
          },
          elementBlock: {
            include: {
              liveQuiz: { include: { templateInfo: true, permissions: true } },
            },
          },
        },
      },
      answerCollection: { include: { entries: true } },
      answerCollectionItems: true,
    },
  })

  if (!element) return []

  const elementOptions = asElementOptions(element.options)
  const asynchronousActivityValid =
    element.type === ElementType.FLASHCARD ||
    element.type === ElementType.CONTENT ||
    element.type === ElementType.FREE_TEXT ||
    Boolean(elementOptions.hasSampleSolution)

  const instanceData = element.elementInstances.reduce<
    {
      instanceId: number
      multiplier: number
      liveQuizId?: string
      practiceQuizId?: string
      microLearningId?: string
      groupActivityId?: string
      templateId?: string
      reviewStatus?: ReviewStatus
    }[]
  >((acc, instance) => {
    if (
      (instance.elementBlock?.liveQuiz?.status === PublicationStatus.DRAFT ||
        instance.elementBlock?.liveQuiz?.status ===
          PublicationStatus.SCHEDULED ||
        (includeTemplates &&
          instance.elementBlock?.liveQuiz?.status ===
            PublicationStatus.TEMPLATE)) &&
      instance.elementBlock.liveQuiz.permissions
        .filter((permission) => permission.userId === userId)
        .some((permission) =>
          requiredActivityAccess.includes(permission.permissionLevel)
        )
    ) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementBlock.liveQuiz.pointsMultiplier,
        liveQuizId: instance.elementBlock.liveQuizId,
        templateId: instance.elementBlock.liveQuiz.templateInfo?.id,
        reviewStatus: instance.elementBlock.liveQuiz.reviewStatus,
      })
    } else if (
      instance.elementStack?.microLearning &&
      asynchronousActivityValid
    ) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementStack.microLearning.pointsMultiplier,
        microLearningId: instance.elementStack.microLearning.id,
        templateId: instance.elementStack.microLearning.templateInfo?.id,
        reviewStatus: instance.elementStack.microLearning.reviewStatus,
      })
    } else if (
      instance.elementStack?.practiceQuiz &&
      asynchronousActivityValid
    ) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementStack.practiceQuiz.pointsMultiplier,
        practiceQuizId: instance.elementStack.practiceQuiz.id,
        templateId: instance.elementStack.practiceQuiz.templateInfo?.id,
        reviewStatus: instance.elementStack.practiceQuiz.reviewStatus,
      })
    } else if (instance.elementStack?.groupActivity) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementStack.groupActivity.pointsMultiplier,
        groupActivityId: instance.elementStack.groupActivity.id,
        templateId: instance.elementStack.groupActivity.templateInfo?.id,
        reviewStatus: instance.elementStack.groupActivity.reviewStatus,
      })
    }

    return acc
  }, [])

  let touchedAnswerCollectionIds: number[] = []
  const updatedInstances = (
    await Promise.allSettled(
      instanceData.map(async (instance) => {
        const oldInstance = await prisma.elementInstance.findUnique({
          where: { id: instance.instanceId },
        })

        if (!oldInstance) return null

        const newElementData = processElementData(element)
        const newResults = getInitialInstanceResults(newElementData)
        const updatedInstance = await prisma.elementInstance.update({
          where: { id: instance.instanceId },
          data: {
            elementData: newElementData,
            results: newResults,
            anonymousResults: newResults,
            options: {
              ...asElementOptions(oldInstance.options),
              basePoints: element.basePoints,
              pointsMultiplier: instance.multiplier * element.pointsMultiplier,
            },
          },
        })

        if (instance.reviewStatus === ReviewStatus.REVIEWED) {
          if (instance.liveQuizId) {
            await prisma.liveQuiz.update({
              where: { id: instance.liveQuizId },
              data: { reviewStatus: ReviewStatus.MODIFIED_AFTER_REVIEW },
            })
          } else if (instance.practiceQuizId) {
            await prisma.practiceQuiz.update({
              where: { id: instance.practiceQuizId },
              data: { reviewStatus: ReviewStatus.MODIFIED_AFTER_REVIEW },
            })
          } else if (instance.microLearningId) {
            await prisma.microLearning.update({
              where: { id: instance.microLearningId },
              data: { reviewStatus: ReviewStatus.MODIFIED_AFTER_REVIEW },
            })
          } else if (instance.groupActivityId) {
            await prisma.groupActivity.update({
              where: { id: instance.groupActivityId },
              data: { reviewStatus: ReviewStatus.MODIFIED_AFTER_REVIEW },
            })
          }
        }

        if (
          includeTemplates &&
          instance.templateId &&
          (element.type === ElementType.SELECTION ||
            element.type === ElementType.CASE_STUDY) &&
          element.answerCollectionId !== null
        ) {
          const activityIds = instance.liveQuizId
            ? {
                activityId: instance.liveQuizId,
                activityType: ActivityType.LIVE_QUIZ,
              }
            : instance.practiceQuizId
              ? {
                  activityId: instance.practiceQuizId,
                  activityType: ActivityType.PRACTICE_QUIZ,
                }
              : instance.microLearningId
                ? {
                    activityId: instance.microLearningId,
                    activityType: ActivityType.MICRO_LEARNING,
                  }
                : instance.groupActivityId
                  ? {
                      activityId: instance.groupActivityId,
                      activityType: ActivityType.GROUP_ACTIVITY,
                    }
                  : null

          if (activityIds) {
            const { answerCollectionIds, answerCollectionEntryIds } =
              await getActivityAnswerCollectionIds({
                ...activityIds,
                prisma,
              })
            const template = await prisma.activityTemplate.findUnique({
              where: { id: instance.templateId },
              include: {
                answerCollections: true,
                answerCollectionItems: true,
              },
            })

            if (!template) return null

            const templateCollectionIds = template.answerCollections.map(
              (collection) => collection.id
            )
            const collectionsToDisconnect = templateCollectionIds.filter(
              (id) => !answerCollectionIds.includes(id)
            )
            const collectionsToConnect = answerCollectionIds.filter(
              (id) => !templateCollectionIds.includes(id)
            )
            const templateCollectionEntryIds =
              template.answerCollectionItems.map((collection) => collection.id)
            const collectionEntriesToDisconnect =
              templateCollectionEntryIds.filter(
                (id) => !answerCollectionEntryIds.includes(id)
              )
            const collectionEntriesToConnect = answerCollectionEntryIds.filter(
              (id) => !templateCollectionEntryIds.includes(id)
            )

            touchedAnswerCollectionIds = touchedAnswerCollectionIds.concat([
              ...collectionsToDisconnect,
              ...collectionsToConnect,
            ])

            if (
              collectionsToConnect.length > 0 ||
              collectionsToDisconnect.length > 0 ||
              collectionEntriesToConnect.length > 0 ||
              collectionEntriesToDisconnect.length > 0
            ) {
              await prisma.activityTemplate.update({
                where: { id: instance.templateId },
                data: {
                  answerCollections:
                    collectionsToConnect.length > 0 ||
                    collectionsToDisconnect.length > 0
                      ? {
                          connect: collectionsToConnect.map((id) => ({ id })),
                          disconnect: collectionsToDisconnect.map((id) => ({
                            id,
                          })),
                        }
                      : undefined,
                  answerCollectionItems:
                    collectionEntriesToConnect.length > 0 ||
                    collectionEntriesToDisconnect.length > 0
                      ? {
                          connect: collectionEntriesToConnect.map((id) => ({
                            id,
                          })),
                          disconnect: collectionEntriesToDisconnect.map(
                            (id) => ({ id })
                          ),
                        }
                      : undefined,
                },
              })
            }
          }
        }

        if (instance.liveQuizId) {
          emitter?.emit('invalidate', {
            typename: 'LiveQuiz',
            id: instance.liveQuizId,
          })
        } else if (instance.practiceQuizId) {
          emitter?.emit('invalidate', {
            typename: 'PracticeQuiz',
            id: instance.practiceQuizId,
          })
        } else if (instance.microLearningId) {
          emitter?.emit('invalidate', {
            typename: 'MicroLearning',
            id: instance.microLearningId,
          })
        } else if (instance.groupActivityId) {
          emitter?.emit('invalidate', {
            typename: 'GroupActivity',
            id: instance.groupActivityId,
          })
        } else if (instance.templateId) {
          emitter?.emit('invalidate', {
            typename: 'Template',
            id: instance.templateId,
          })
        }

        return updatedInstance
      })
    )
  ).flatMap((result) => {
    if (result.status !== 'fulfilled' || !result.value) return []
    return result.value
  })

  if (includeTemplates) {
    for (const id of [...new Set(touchedAnswerCollectionIds)]) {
      await recomputeDerivedPermissions({ answerCollectionId: id }, prisma)
    }
  }

  await flagOutdatedElementInstances({
    elementId,
    prisma,
    emitter,
  })

  return updatedInstances
}

async function flagOutdatedElementInstances({
  elementId,
  prisma,
  emitter,
}: {
  elementId: number
  prisma: PrismaTransactionClient
  emitter: TRPCContext['emitter']
}) {
  const element = await prisma.element.findUnique({
    where: { id: elementId, isDeleted: false },
  })

  if (!element) return false

  const outdatedInstances = await prisma.elementInstance.findMany({
    where: {
      elementId,
      NOT: {
        elementData: {
          path: ['id'],
          equals: `${elementId}-v${element.version}`,
        },
      },
      OR: [
        { elementBlock: { liveQuiz: { isDeleted: false } } },
        { elementStack: { microLearning: { isDeleted: false } } },
        { elementStack: { practiceQuiz: { isDeleted: false } } },
        { elementStack: { groupActivity: { isDeleted: false } } },
      ],
    },
    include: {
      elementBlock: { include: { liveQuiz: true } },
      elementStack: {
        include: {
          microLearning: true,
          practiceQuiz: true,
          groupActivity: true,
        },
      },
    },
  })

  for (const instance of outdatedInstances) {
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: { isVersionOutdated: true },
    })

    if (instance.elementBlock?.liveQuizId) {
      await prisma.liveQuiz.update({
        where: { id: instance.elementBlock.liveQuizId },
        data: { areInstancesOutdated: true },
      })
      emitter?.emit('invalidate', {
        typename: 'LiveQuiz',
        id: instance.elementBlock.liveQuizId,
      })
    } else if (instance.elementStack?.microLearningId) {
      await prisma.microLearning.update({
        where: { id: instance.elementStack.microLearningId },
        data: { areInstancesOutdated: true },
      })
      emitter?.emit('invalidate', {
        typename: 'MicroLearning',
        id: instance.elementStack.microLearningId,
      })
    } else if (instance.elementStack?.practiceQuizId) {
      await prisma.practiceQuiz.update({
        where: { id: instance.elementStack.practiceQuizId },
        data: { areInstancesOutdated: true },
      })
      emitter?.emit('invalidate', {
        typename: 'PracticeQuiz',
        id: instance.elementStack.practiceQuizId,
      })
    } else if (instance.elementStack?.groupActivityId) {
      await prisma.groupActivity.update({
        where: { id: instance.elementStack.groupActivityId },
        data: { areInstancesOutdated: true },
      })
      emitter?.emit('invalidate', {
        typename: 'GroupActivity',
        id: instance.elementStack.groupActivityId,
      })
    }
  }

  return true
}

async function changeElementStatus({
  ctx,
  elementId,
  status,
}: {
  ctx: TRPCContext & { user: { sub: string } }
  elementId: number
  status: ElementStatus
}) {
  const prisma = getPrisma(ctx)
  const previousElement = await prisma.element.findUnique({
    where: { id: elementId },
  })

  if (!previousElement) return false

  const element = await prisma.element.update({
    where: { id: elementId },
    data: { status },
  })

  if (status && status !== previousElement.status) {
    const modificationDetails: ActivityLogModificationDetails = {
      field: ActivityLogModificationFieldType.STATUS,
      oldValue: previousElement.status,
      newValue: status,
    }

    await prisma.activityLogEntry.create({
      data: {
        type: ActivityLogType.MODIFICATION,
        modificationDetails,
        objectType: ObjectType.ELEMENT,
        elementId,
        userId: ctx.user.sub,
      },
    })
  }

  ctx.emitter?.emit('invalidate', {
    typename: 'Element',
    id: element.id,
  })

  return true
}

export const elementRouter = router({
  single: userProcedure.input(elementIdInput).query(async ({ ctx, input }) => {
    if (
      !(await hasElementPermission({
        ctx,
        id: input.id,
        permissionLevel: PermissionLevel.READ,
      }))
    ) {
      return { element: null }
    }

    const element = await getSingleElementForEdit({ ctx, id: input.id })
    return { element }
  }),

  manipulateContent: userFullAccessProcedure
    .input(manipulateContentElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        { ...input, type: ElementType.CONTENT },
        ctx
      )
      return { element }
    }),

  manipulateFlashcard: userFullAccessProcedure
    .input(manipulateFlashcardElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        { ...input, type: ElementType.FLASHCARD },
        ctx
      )
      return { element }
    }),

  manipulateChoices: userFullAccessProcedure
    .input(manipulateChoicesElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        input as ElementManipulationInput,
        ctx
      )
      return { element }
    }),

  manipulateNumerical: userFullAccessProcedure
    .input(manipulateNumericalElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        { ...input, type: ElementType.NUMERICAL },
        ctx
      )
      return { element }
    }),

  manipulateFreeText: userFullAccessProcedure
    .input(manipulateFreeTextElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        { ...input, type: ElementType.FREE_TEXT },
        ctx
      )
      return { element }
    }),

  manipulateSelection: userFullAccessProcedure
    .input(manipulateSelectionElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        { ...input, type: ElementType.SELECTION },
        ctx
      )
      return { element }
    }),

  manipulateCaseStudy: userFullAccessProcedure
    .input(manipulateCaseStudyElementInput)
    .mutation(async ({ ctx, input }) => {
      if (
        typeof input.id === 'number' &&
        !(await hasElementPermission({
          ctx,
          id: input.id,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { element: null }
      }

      const element = await manipulateElement(
        { ...input, type: ElementType.CASE_STUDY },
        ctx
      )
      return { element }
    }),

  updateInstances: userFullAccessProcedure
    .input(updateElementInstancesInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasElementPermission({
          ctx,
          id: input.elementId,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { elementInstances: null }
      }

      const prisma = getPrisma(ctx)
      const elementInstances = await updateElementInstances({
        ...input,
        prisma,
        emitter: ctx.emitter,
        userId: ctx.user.sub,
      })

      return {
        elementInstances: elementInstances.map((instance) => ({
          id: instance.id,
        })),
      }
    }),

  flagOutdatedInstances: userFullAccessProcedure
    .input(flagOutdatedElementInstancesInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasElementPermission({
          ctx,
          id: input.elementId,
          permissionLevel: PermissionLevel.WRITE,
        }))
      ) {
        return { success: null }
      }

      const prisma = getPrisma(ctx)
      const success = await flagOutdatedElementInstances({
        elementId: input.elementId,
        prisma,
        emitter: ctx.emitter,
      })

      return { success }
    }),

  changeStatus: userFullAccessProcedure
    .input(changeElementStatusInput)
    .mutation(async ({ ctx, input }) => {
      if (
        !(await hasElementPermission({
          ctx,
          id: input.elementId,
          permissionLevel: PermissionLevel.READ,
        }))
      ) {
        return { success: null }
      }

      const success = await changeElementStatus({ ctx, ...input })
      return { success }
    }),

  tags: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.sub },
      include: { tags: { orderBy: { order: 'asc' } } },
    })

    return { tags: user?.tags.map(toTagDto) ?? [] }
  }),

  summary: userProcedure.input(elementIdInput).query(async ({ ctx, input }) => {
    if (!(await hasElementAdminPermission({ ctx, id: input.id }))) {
      return { elementSummary: null }
    }

    const prisma = getPrisma(ctx)
    const adminLevels = [PermissionLevel.ADMIN, PermissionLevel.OWNER]
    const element = await prisma.element.findUnique({
      where: { id: input.id },
      include: {
        answerCollection: {
          include: {
            permissions: {
              where: {
                userId: ctx.user.sub,
                permissionLevel: { not: PermissionLevel.OWNER },
              },
            },
          },
        },
        elementInstances: {
          include: {
            elementStack: {
              include: {
                microLearning: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
                practiceQuiz: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
                groupActivity: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
                      },
                    },
                  },
                },
              },
            },
            elementBlock: {
              include: {
                liveQuiz: {
                  include: {
                    permissions: {
                      where: {
                        userId: ctx.user.sub,
                        permissionLevel: { in: adminLevels },
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

    if (!element) return { elementSummary: null }

    return {
      elementSummary: {
        sharedElementActivityUse: element.elementInstances.some(
          (instance) => instance.ownerId !== ctx.user.sub
        ),
        retainsDerivedAccess: element.elementInstances.some(
          (instance) =>
            (instance.elementStack?.microLearning?.permissions.length ?? 0) >
              0 ||
            (instance.elementStack?.practiceQuiz?.permissions.length ?? 0) >
              0 ||
            (instance.elementStack?.groupActivity?.permissions.length ?? 0) >
              0 ||
            (instance.elementBlock?.liveQuiz?.permissions.length ?? 0) > 0
        ),
        derivedAccessToResources:
          (element.answerCollection?.permissions.length ?? 0) > 0,
      },
    }
  }),

  delete: userFullAccessProcedure
    .input(elementIdInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await hasElementAdminPermission({ ctx, id: input.id }))) {
        return { deletedElementId: null }
      }

      const prisma = getPrisma(ctx)
      const { deletedElement, originalElement } = await prisma.$transaction(
        async (transaction) => {
          const originalElement = await transaction.element.findUnique({
            where: { id: input.id },
          })

          if (!originalElement) {
            throw new Error('Element not found')
          }

          const deletedElement = await transaction.element.update({
            where: { id: input.id },
            data: {
              isDeleted: true,
              answerCollection: { disconnect: true },
              answerCollectionItems: { set: [] },
              directPermissions: { deleteMany: {} },
            },
            include: { tags: true },
          })

          await recomputeDerivedPermissions(
            { elementId: input.id },
            transaction
          )

          if (originalElement.answerCollectionId !== null) {
            await recomputeDerivedPermissions(
              { answerCollectionId: originalElement.answerCollectionId },
              transaction
            )
          }

          for (const tag of deletedElement.tags) {
            const elementTag = await transaction.tag.findUnique({
              where: { id: tag.id },
              include: {
                _count: {
                  select: { questions: { where: { isDeleted: false } } },
                },
              },
            })

            if (elementTag?._count.questions === 0) {
              await transaction.tag.delete({ where: { id: tag.id } })
            }
          }

          await transaction.element.update({
            where: { id: input.id },
            data: { tags: { set: [] } },
          })

          return { deletedElement, originalElement }
        },
        { timeout: 60000 }
      )

      ctx.emitter?.emit('invalidate', {
        typename: 'Element',
        id: deletedElement.id,
      })

      if (deletedElement.answerCollectionId) {
        ctx.emitter?.emit('invalidate', {
          typename: 'AnswerCollection',
          id: originalElement.answerCollectionId,
        })
      }

      return { deletedElementId: deletedElement.id }
    }),

  editTag: userFullAccessProcedure
    .input(editTagInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const existingTag = await prisma.tag.findUnique({
        where: { ownerId_name: { ownerId: ctx.user.sub, name: input.name } },
      })

      if (existingTag) {
        return { tag: null }
      }

      const tag = await prisma.tag.update({
        where: { id: input.id, ownerId: ctx.user.sub },
        data: { name: input.name },
      })

      return { tag: toTagDto(tag) }
    }),

  deleteTag: userFullAccessProcedure
    .input(elementIdInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const tag = await prisma.tag.delete({
        where: {
          id: input.id,
          ownerId: ctx.user.sub,
        },
      })

      ctx.emitter?.emit('invalidate', {
        typename: 'Tag',
        id: tag.id,
      })

      return { tag: toTagDto(tag) }
    }),

  updateTagOrdering: userFullAccessProcedure
    .input(tagOrderingInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const tags = await prisma.tag.findMany({
        where: {
          ownerId: ctx.user.sub,
        },
        orderBy: {
          order: 'asc',
        },
      })

      const sortedTags = [...tags].sort(
        (a, b) => a.order - b.order || a.name.localeCompare(b.name)
      )
      const reorderedTags = reorderTags(
        sortedTags,
        input.originIx,
        input.targetIx
      )

      await prisma.$transaction(
        reorderedTags.map((tag, ix) =>
          prisma.tag.update({
            where: { id: tag.id },
            data: { order: ix },
          })
        )
      )

      return { tags: reorderedTags.map(toTagDto) }
    }),
})
