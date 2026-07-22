import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityLogModificationDetails,
  ActivityLogModificationFieldType,
  ActivityType,
  ElementManipulationInput,
  SharingType,
  SortByType,
} from '@klicker-uzh/types'
import {
  getInitialInstanceResults,
  PrismaTransactionClient,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import dayjs from 'dayjs'
import EventEmitter from 'events'
import { prop, sortBy, swapIndices, uniqueBy } from 'remeda'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../lib/context.js'
import { IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION } from '../lib/importExportFingerprintCanonicalization.js'
import {
  createPendingDirectUploadOriginalId,
  DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
  DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
} from '../lib/importExportMediaIdentity.js'
import { getImportExportRuntimeConfig } from '../lib/importExportRuntimeConfig.js'
import { SUPPORTED_MEDIA_CONTENT_TYPE_EXTENSIONS } from '../lib/mediaContentTypes.js'
import { prepareElementMutation } from './elementMutationPreparation.js'
import {
  ensureElementFingerprintCurrent,
  finalizeUploadedMediaFingerprintV1,
  lockElementFingerprintDependencies,
} from './importExportFingerprints.js'
import { getAnswerCollectionsElements } from './resources.js'
import { checkAccess } from './sharing.js'
import { getActivityAnswerCollectionIds } from './templates.js'

export async function getUserElements(
  {
    status,
    type,
    hasSampleSolution,
    hasAnswerFeedbacks,
    searchString,
    showOwned = true,
    showShared = true,
    showDependencies = true,
    tagIds,
    activityId,
    multiplier,
    showUntagged,
    sortByType,
    sortByAsc,
    showArchived,
    numEntries,
    offset,
  }: {
    status?: DB.ElementStatus | null
    type?: DB.ElementType | null
    hasSampleSolution: boolean
    hasAnswerFeedbacks: boolean
    searchString?: string | null
    showOwned?: boolean | null
    showShared?: boolean | null
    showDependencies?: boolean | null
    tagIds: number[]
    activityId?: string | null
    multiplier?: number | null
    showUntagged: boolean
    sortByType: SortByType
    sortByAsc: boolean
    showArchived: boolean
    numEntries: number
    offset: number
  },
  ctx: ContextWithUser
) {
  // where clause needed for filtering the desired elements
  const elementFilteringClause = {
    // filter out objects where the user only has derived access to and they were deleted before
    NOT: { derived: true, element: { isDeleted: true } },
    // depending on the shared access flags, determine the required access levels
    permissionLevel:
      showOwned && showShared
        ? undefined
        : {
            in: [
              ...(showOwned ? [DB.PermissionLevel.OWNER] : []),
              ...(showShared
                ? [
                    DB.PermissionLevel.ADMIN,
                    DB.PermissionLevel.WRITE,
                    DB.PermissionLevel.EXECUTE,
                    DB.PermissionLevel.READ,
                  ]
                : []),
            ],
          },
    // chose whether to include objects that are available through derived access
    derived: showDependencies ? undefined : false,
    // filters and search strings beside sharing filters
    elementId: { not: null },
    element: {
      status: status ? status : undefined,
      type: type ? type : undefined,
      isArchived: showArchived ? undefined : false,
      tags: showUntagged ? { none: { ownerId: ctx.user.sub } } : undefined,
      AND: [
        ...(multiplier ? [{ pointsMultiplier: multiplier }] : []),
        ...(hasSampleSolution
          ? [{ options: { path: ['hasSampleSolution'], equals: true } }]
          : []),
        ...(hasAnswerFeedbacks
          ? [{ options: { path: ['hasAnswerFeedbacks'], equals: true } }]
          : []),
        ...(tagIds.length > 0
          ? tagIds.map((id) => ({
              tags: { some: { id } },
            }))
          : []),
        ...(activityId
          ? [
              {
                elementInstances: {
                  some: {
                    OR: [
                      { elementBlock: { liveQuizId: activityId } },
                      { elementStack: { practiceQuizId: activityId } },
                      { elementStack: { microLearningId: activityId } },
                      { elementStack: { groupActivityId: activityId } },
                    ],
                  },
                },
              },
            ]
          : []),
      ],
      OR: searchString
        ? [
            {
              name: {
                contains: searchString,
                mode: 'insensitive' as DB.Prisma.QueryMode,
              },
            },
            {
              content: {
                contains: searchString,
                mode: 'insensitive' as DB.Prisma.QueryMode,
              },
            },
          ]
        : undefined,
    },
  }

  // fetch all elements that are available to the user
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      _count: { select: { objects: { where: elementFilteringClause } } },
      objects: {
        where: elementFilteringClause,
        include: {
          directPermission: true,
          element: {
            include: {
              tags: {
                where: { ownerId: ctx.user.sub }, // tags are personal and should not be shared
                orderBy: { order: 'asc' },
              },
              // ? hide number of shared users for now due to performance drawbacks
              // _count: {
              //   select: {
              //     permissions: true,
              //   },
              // },
            },
          },
        },
        orderBy: [
          ...(sortByType === SortByType.CREATED
            ? [
                {
                  element: {
                    createdAt: (sortByAsc
                      ? 'asc'
                      : 'desc') as DB.Prisma.SortOrder,
                  },
                },
              ]
            : []),
          ...(sortByType === SortByType.MODIFIED
            ? [
                {
                  element: {
                    updatedAt: (sortByAsc
                      ? 'asc'
                      : 'desc') as DB.Prisma.SortOrder,
                  },
                },
              ]
            : []),
          ...(sortByType === SortByType.TITLE
            ? [
                {
                  element: {
                    name: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder,
                  },
                },
              ]
            : []),
          ...(sortByType === SortByType.TYPE
            ? [
                {
                  element: {
                    type: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder,
                  },
                },
              ]
            : []),
          ...(sortByType === SortByType.STATUS
            ? [
                {
                  element: {
                    status: (sortByAsc ? 'asc' : 'desc') as DB.Prisma.SortOrder,
                  },
                },
              ]
            : []),
          // break ties using the modification date
          {
            element: { updatedAt: 'desc' as DB.Prisma.SortOrder },
          },
        ],
        take: numEntries ?? undefined,
        skip: offset ?? undefined,
      },
    },
  })

  if (!user) {
    return null
  }

  return {
    numOfElements: user._count.objects,
    elements: user.objects.map((object) => ({
      ...object.element!,
      permissionLevel: object.permissionLevel,
      derivedAccess: object.derived,
      numSharedUsers: undefined, // object.element._count.permissions - 1,
      isOwner: object.permissionLevel === DB.PermissionLevel.OWNER,
      isManager:
        object.permissionLevel === DB.PermissionLevel.OWNER ||
        object.permissionLevel === DB.PermissionLevel.ADMIN,
      isEditor:
        object.permissionLevel === DB.PermissionLevel.OWNER ||
        object.permissionLevel === DB.PermissionLevel.ADMIN ||
        object.permissionLevel === DB.PermissionLevel.WRITE,
      isImported:
        object.permissionLevel === DB.PermissionLevel.OWNER &&
        object.element!.originalId !== null,
      isShared: object.permissionLevel !== DB.PermissionLevel.OWNER,
      // object can be removed, if the object is shared and the permission is not derived / granted through a user group
      isRemovable:
        object.permissionLevel !== DB.PermissionLevel.OWNER &&
        !object.derived &&
        object.directPermission?.userGroupId === null,
      sharingType:
        object.permissionLevel === DB.PermissionLevel.OWNER
          ? SharingType.OWNED
          : object.derived
            ? SharingType.DEPENDENCY
            : SharingType.SHARED,
    })),
  }
}

export async function getSingleElement(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const element = await ctx.prisma.element.findUnique({
    where: { id, permissions: { some: { userId: ctx.user.sub } } },
    include: {
      permissions: {
        where: { userId: ctx.user.sub },
      },
      tags: {
        where: { ownerId: ctx.user.sub }, // tags are personal and should not be shared
        orderBy: { order: 'asc' },
      },
      answerCollectionItems: true,
    },
  })

  if (!element) {
    return null
  }

  const selectedItemIds = element.answerCollectionItems.map((item) => item.id)
  const permission = element.permissions[0]

  return {
    ...element,
    permissionLevel: permission!.permissionLevel,
    derivedAccess: permission!.derived,
    isOwner: permission!.permissionLevel === DB.PermissionLevel.OWNER,
    isManager:
      permission!.permissionLevel === DB.PermissionLevel.OWNER ||
      permission!.permissionLevel === DB.PermissionLevel.ADMIN,
    isEditor:
      permission!.permissionLevel === DB.PermissionLevel.OWNER ||
      permission!.permissionLevel === DB.PermissionLevel.ADMIN ||
      permission!.permissionLevel === DB.PermissionLevel.WRITE,
    options: {
      ...element.options,
      // SE elements
      answerCollection: { id: element.answerCollectionId, entries: [] },
      // SE elements
      answerCollectionSolutionIds: selectedItemIds,
      // CS elements
      answerCollectionId: element.answerCollectionId,
      // CS elements
      collectionItemIds: selectedItemIds,
    },
  }
}

export async function getArtificialElementInstance(
  { elementId }: { elementId: number },
  ctx: ContextWithUser
) {
  const element = await ctx.prisma.element.findUnique({
    where: { id: elementId },
    include: {
      answerCollection: { include: { entries: true } },
      answerCollectionItems: true,
    },
  })

  if (!element) return null

  const elementData = processElementData(element)
  const initialResults = getInitialInstanceResults(elementData)

  return {
    id: 0,
    elementId: element.id,
    elementType: element.type,
    order: 0,
    type: DB.ElementInstanceType.LIVE_QUIZ,
    elementData,
    options: {
      basePoints: element.basePoints,
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

export async function getSingleElementInstance(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // fetch instance and check that the user has access to the activity the instance is included in (minimum READ access is sufficient)
  const instance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id,
      OR: [
        {
          elementBlock: {
            liveQuiz: {
              permissions: { some: { userId: ctx.user.sub } },
            },
          },
        },
        {
          elementStack: {
            OR: [
              {
                practiceQuiz: {
                  permissions: { some: { userId: ctx.user.sub } },
                },
              },
              {
                microLearning: {
                  permissions: { some: { userId: ctx.user.sub } },
                },
              },
              {
                groupActivity: {
                  permissions: { some: { userId: ctx.user.sub } },
                },
              },
            ],
          },
        },
      ],
    },
  })

  return instance
}

export async function manipulateElement(
  input: ElementManipulationInput,
  ctx: ContextWithUser
) {
  return await ctx.prisma.$transaction(
    async (prisma) =>
      await manipulateElementInTransaction(input, { ...ctx, prisma }),
    { timeout: 60000 }
  )
}

export async function manipulateElementInTransaction(
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
    templateId,
  }: ElementManipulationInput,
  // type modification required for method to be usable inside transaction without type errors
  ctx: PrismaTransactionContextWithUser
) {
  let tagsToDisconnect: string[] = []

  // Partial edits need the persisted shared fields and options to validate the
  // resulting element, rather than validating only the fields present in the
  // request.
  const isNewElement = typeof id === 'undefined' || id === null
  const elementPrev = !isNewElement
    ? await ctx.prisma.element.findUnique({
        where: { id, isDeleted: false },
        include: {
          tags: { orderBy: { order: 'asc' } },
          answerCollectionItems: true,
        },
      })
    : undefined

  if (!isNewElement && (!elementPrev || elementPrev.type !== type)) {
    return null
  }

  // determine which tags have been deconnected
  if (elementPrev?.tags && tags) {
    tagsToDisconnect = elementPrev.tags
      .filter((tag) => !tags?.includes(tag.name))
      .map((tag) => tag.name)
  }

  const prepared = await prepareElementMutation(
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
      templateId,
    },
    elementPrev ?? undefined,
    async (answerCollectionId) => {
      if (templateId) {
        // fetch all answer collections that are either available directly or through template
        const availableAnswerCollections = await getAnswerCollectionsElements(
          { templateId },
          ctx
        )

        // check if the answer collection that should be linked is available
        const answerCollection = availableAnswerCollections.find(
          (collection) => collection.id === answerCollectionId
        )

        return answerCollection?.entries.map((entry) => entry.id) ?? null
      } else {
        // access check for answer collection
        const validAccess = await checkAccess(
          [
            {
              answerCollectionId,
              minimumPermissionLevel: DB.PermissionLevel.READ,
            },
          ],
          ctx
        )

        if (!validAccess) return null

        const answerCollection = await ctx.prisma.answerCollection.findFirst({
          where: { id: answerCollectionId, isDeleted: false },
          select: { entries: { select: { id: true } } },
        })
        return answerCollection?.entries.map((entry) => entry.id) ?? null
      }
    }
  )
  if (!prepared) return null

  const { domain: canonicalDomain, relationWrite } = prepared
  const processedOptions = canonicalDomain.options

  await lockElementFingerprintDependencies(
    {
      answerCollectionId: prepared.answerCollectionId,
      type,
      content: canonicalDomain.content,
      explanation: canonicalDomain.explanation,
      options: processedOptions,
      requireVerifiedMedia: getImportExportRuntimeConfig().enabled,
    },
    ctx.prisma
  )

  const element = await ctx.prisma.element.upsert({
    where: { id: typeof id !== 'undefined' && id !== null ? id : -1 },
    create: {
      status: prepared.status,
      type,
      name: prepared.name,
      content: canonicalDomain.content,
      explanation: canonicalDomain.explanation ?? undefined,
      basePoints: canonicalDomain.basePoints,
      pointsMultiplier: canonicalDomain.pointsMultiplier,
      options: processedOptions,
      owner: { connect: { id: ctx.user.sub } },
      // connect to the tags which already exist by name and otherwise create a new tag with the given name
      tags: {
        connectOrCreate: tags?.map((tag: string) => {
          return {
            where: { ownerId_name: { ownerId: ctx.user.sub, name: tag } },
            create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
          }
        }),
      },
      // connect the selection question to the corresponding answer collection
      answerCollection: relationWrite
        ? { connect: { id: relationWrite.answerCollectionId } }
        : undefined,
      // connect the answer collection options to the selection question if sample solution is enabled
      answerCollectionItems:
        relationWrite &&
        type === DB.ElementType.SELECTION &&
        relationWrite.connectSelectedItems
          ? {
              connect: relationWrite.selectedIds.map((id) => ({ id })),
            }
          : relationWrite && type === DB.ElementType.CASE_STUDY
            ? {
                connect: relationWrite.selectedIds.map((id) => ({ id })),
              }
            : undefined,
    },
    update: {
      status: status ?? undefined,
      name: name ?? undefined,
      content:
        typeof content === 'undefined' ? undefined : canonicalDomain.content,
      explanation:
        typeof explanation === 'undefined'
          ? undefined
          : canonicalDomain.explanation,
      basePoints:
        type === DB.ElementType.CONTENT || type === DB.ElementType.FLASHCARD
          ? false
          : typeof basePoints === 'undefined'
            ? undefined
            : canonicalDomain.basePoints,
      pointsMultiplier:
        typeof pointsMultiplier === 'undefined'
          ? undefined
          : canonicalDomain.pointsMultiplier,
      version: { increment: 1 },
      options: prepared.shouldWriteOptions ? processedOptions : undefined,
      // connect or create new tags and disconnect previous ones if they are selected anymore
      tags: {
        connectOrCreate: tags
          ?.filter((tag: string) => tag !== '')
          .map((tag: string) => {
            return {
              where: { ownerId_name: { ownerId: ctx.user.sub, name: tag } },
              create: { name: tag, owner: { connect: { id: ctx.user.sub } } },
            }
          }),
        disconnect: tagsToDisconnect.map((tag) => {
          return {
            ownerId_name: { ownerId: ctx.user.sub, name: tag },
          }
        }),
      },
      // connect new answer collection and disconnect previous one if they are not the same
      answerCollection: relationWrite
        ? { connect: { id: relationWrite.answerCollectionId } }
        : undefined,
      // connect or disconnect the answer collection options if sample solution is enabled
      answerCollectionItems: relationWrite
        ? {
            connect:
              type === DB.ElementType.SELECTION
                ? relationWrite.connectSelectedItems
                  ? relationWrite.selectedIds.map((id) => ({ id }))
                  : undefined
                : type === DB.ElementType.CASE_STUDY
                  ? relationWrite.selectedIds.map((id) => ({ id }))
                  : undefined,
            disconnect: relationWrite.disconnectIds.map((id) => ({ id })),
          }
        : undefined,
    },
    include: {
      tags: {
        orderBy: {
          order: 'asc',
        },
      },
      answerCollectionItems: true,
    },
  })

  await ensureElementFingerprintCurrent(element.id, ctx.prisma)

  // compute derived permissions as required for this question
  await recomputeDerivedPermissions(
    { elementId: element.id, userId: ctx.user.sub },
    ctx.prisma
  )

  // if the answer collection linked to the element has changed, recompute the derived permissions for the removed answer collection
  if (
    elementPrev?.answerCollectionId !== null &&
    typeof elementPrev?.answerCollectionId !== 'undefined' &&
    element.answerCollectionId !== elementPrev.answerCollectionId
  ) {
    await recomputeDerivedPermissions(
      { answerCollectionId: elementPrev.answerCollectionId },
      ctx.prisma
    )
  }

  // track element creation or modification
  // ? status changes are tracked through the corresponding separate mutation
  if (isNewElement) {
    // create an activity log entry for element creation
    await ctx.prisma.activityLogEntry.create({
      data: {
        type: DB.ActivityLogType.CREATION,
        objectType: DB.ObjectType.ELEMENT,
        elementId: element.id,
        userId: ctx.user.sub,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt,
      },
    })
  } else if (elementPrev) {
    // track title changes
    if (name && name !== elementPrev.name) {
      const modificationDetails: ActivityLogModificationDetails = {
        field: ActivityLogModificationFieldType.TITLE,
        oldValue: elementPrev.name,
        newValue: name,
      }

      await ctx.prisma.activityLogEntry.create({
        data: {
          type: DB.ActivityLogType.MODIFICATION,
          modificationDetails,
          objectType: DB.ObjectType.ELEMENT,
          elementId: element.id,
          userId: ctx.user.sub,
        },
      })
    }
  }

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: element.id,
  })

  if (
    (type === DB.ElementType.SELECTION || type === DB.ElementType.CASE_STUDY) &&
    typeof prepared.answerCollectionId === 'number'
  ) {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: prepared.answerCollectionId,
    })
  }

  return {
    ...element,
    options: {
      ...element.options,
      // SE elements
      answerCollection: { id: element.answerCollectionId, entries: [] },
      // SE elements
      answerCollectionSolutionIds: element.answerCollectionItems.map(
        (sol) => sol.id
      ),
      // CS elements
      answerCollectionId: element.answerCollectionId,
      // CS elements
      collectionItemIds: element.answerCollectionItems.map((item) => item.id),
    },
  }
}

export async function applyElementBatchOperations(
  {
    elementIds,
    archive,
    unarchive,
    status,
    multiplier,
    basePoints,
    updateInstances,
    updateTemplateInstances,
  }: {
    elementIds: number[]
    archive: boolean
    unarchive: boolean
    status?: DB.ElementStatus | null
    multiplier?: number | null
    basePoints?: boolean | null
    updateInstances: boolean
    updateTemplateInstances: boolean
  },
  ctx: ContextWithUser
) {
  if (elementIds.length === 0) {
    return 0
  }

  // determine the required access level for the batch operation, depending on the selected actions
  let requiredPermissionLevels: DB.PermissionLevel[] = []
  if (archive || unarchive) {
    // archiving / unarchiving requires at least ADMIN access
    requiredPermissionLevels = [
      DB.PermissionLevel.OWNER,
      DB.PermissionLevel.ADMIN,
    ]
  } else if (
    (typeof multiplier !== 'undefined' && multiplier !== null) ||
    (typeof basePoints !== 'undefined' && basePoints !== null)
  ) {
    // modifying points requires at least WRITE access
    requiredPermissionLevels = [
      DB.PermissionLevel.OWNER,
      DB.PermissionLevel.ADMIN,
      DB.PermissionLevel.WRITE,
    ]
  } else if (typeof status !== 'undefined' && status !== null) {
    // changing status requires at least READ access
    requiredPermissionLevels = [
      DB.PermissionLevel.OWNER,
      DB.PermissionLevel.ADMIN,
      DB.PermissionLevel.WRITE,
      DB.PermissionLevel.EXECUTE,
      DB.PermissionLevel.READ,
    ]
  } else {
    // no actions selected, nothing to do
    return 0
  }

  // if both archive and unarchive are true, disable the action (no elements should be selected)
  if (archive && unarchive) {
    return 0
  }

  // fetch all elements that should be modified
  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elementIds },
      isDeleted: false,
      permissions: {
        some: {
          userId: ctx.user.sub,
          permissionLevel: { in: requiredPermissionLevels },
        },
      },
      // if elements should be archived / unarchived, they should not be in the corresponding state already
      isArchived: archive ? false : unarchive ? true : undefined,
      // if the multiplier should be modified, the element should have a sample solution defined
      options:
        typeof multiplier !== 'undefined' && multiplier !== null
          ? { path: ['hasSampleSolution'], equals: true }
          : undefined,
      // if base points should be set / unset, the element must not be a flashcard or content element
      type:
        typeof basePoints !== 'undefined' && basePoints !== null
          ? { notIn: [DB.ElementType.FLASHCARD, DB.ElementType.CONTENT] }
          : undefined,
    },
  })

  // if no elements were found, return 0
  if (dbElements.length === 0) {
    return 0
  }

  // execute the required element updates and, if enabled, update the corresponding linked instances
  // needs to be sequential since element instance updates potentially include derived permission updates
  const updatedElements: DB.Element[] = []
  for (const element of dbElements) {
    const updatedElement = await ctx.prisma.$transaction(async (tx) => {
      await lockElementFingerprintDependencies(
        {
          ...element,
          requireVerifiedMedia: getImportExportRuntimeConfig().enabled,
        },
        tx
      )

      // execute the element update
      const updatedElement = await tx.element.update({
        where: { id: element.id },
        data: {
          version: { increment: 1 },
          isArchived: archive ? true : unarchive ? false : undefined,
          status: status ?? undefined,
          pointsMultiplier:
            typeof multiplier !== 'undefined' && multiplier !== null
              ? multiplier
              : undefined,
          basePoints:
            typeof basePoints !== 'undefined' && basePoints !== null
              ? element.type !== DB.ElementType.CONTENT &&
                element.type !== DB.ElementType.FLASHCARD
                ? basePoints
                : false
              : undefined,
        },
      })

      await ensureElementFingerprintCurrent(updatedElement.id, tx)

      // if enabled, update the corresponding element instances
      if (updateInstances) {
        await updateElementInstances(
          {
            elementId: updatedElement.id,
            includeTemplates: updateTemplateInstances,
          },
          tx,
          ctx.emitter,
          ctx.user.sub
        )
      }

      return updatedElement
    })
    updatedElements.push(updatedElement)
  }

  // return the number of successfully updated elements
  return updatedElements.length
}

export async function changeElementStatus(
  { elementId, status }: { elementId: number; status: DB.ElementStatus },
  ctx: ContextWithUser
) {
  const element = await ctx.prisma.$transaction(async (tx) => {
    const previousElement = await tx.element.findUnique({
      where: { id: elementId },
    })

    if (!previousElement) return null

    await lockElementFingerprintDependencies(
      {
        ...previousElement,
        requireVerifiedMedia: getImportExportRuntimeConfig().enabled,
      },
      tx
    )

    const element = await tx.element.update({
      where: { id: elementId },
      data: { status },
    })
    await ensureElementFingerprintCurrent(element.id, tx)

    if (status && status !== previousElement.status) {
      const modificationDetails: ActivityLogModificationDetails = {
        field: ActivityLogModificationFieldType.STATUS,
        oldValue: previousElement.status,
        newValue: status,
      }

      await tx.activityLogEntry.create({
        data: {
          type: DB.ActivityLogType.MODIFICATION,
          modificationDetails,
          objectType: DB.ObjectType.ELEMENT,
          elementId,
          userId: ctx.user.sub,
        },
      })
    }

    return element
  })

  if (!element) {
    return false
  }

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: element.id,
  })

  return true
}

export async function deleteElement(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // soft delete element and disconnect linked answer collection and sample solutions
  const { deletedElement, originalElement } = await ctx.prisma.$transaction(
    async (prisma) => {
      const originalElement = await prisma.element.findUnique({ where: { id } })

      if (!originalElement) {
        throw new Error('Element not found')
      }

      // TODO: evaluate if soft deletion of elements is still required (assuming that there are no derived permissions on them anymore)
      // ! Once elements are hard deleted, the propagation to dependent resources (e.g. answer collections) need to be handled manually in this mutation
      // ! --> for comparison, check the hard and soft-deletion logic for all activity types (live quiz / practice quiz / microlearning / group activity)
      const element = await prisma.element.update({
        where: { id },
        data: {
          isDeleted: true,
          answerCollection: { disconnect: true },
          answerCollectionItems: { set: [] },
          directPermissions: { deleteMany: {} }, // delete all direct permissions on the element
        },
        include: { tags: true },
      })

      // update derived permissions for element
      await recomputeDerivedPermissions({ elementId: id }, prisma)

      // update derived permissions on the linked answer collection (if defined) -> derived permissions
      if (originalElement.answerCollectionId !== null) {
        await recomputeDerivedPermissions(
          { answerCollectionId: originalElement.answerCollectionId },
          prisma
        )
      }

      // if the element was linked to any tags, check if the tags still have other elements linked to it
      for (const tag of element.tags) {
        const elementTag = await prisma.tag.findUnique({
          where: { id: tag.id },
          include: {
            _count: { select: { questions: { where: { isDeleted: false } } } },
          },
        })

        // if the tag has no other questions linked to it, delete it
        if (elementTag?._count.questions === 0) {
          await prisma.tag.delete({ where: { id: tag.id } })
        }
      }

      // remove all tags from the soft-deleted element
      await prisma.element.update({
        where: { id },
        data: { tags: { set: [] } },
      })

      return { deletedElement: element, originalElement }
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id: deletedElement.id,
  })

  // if answer collection was connected, invalidate it
  if (deletedElement.answerCollectionId) {
    ctx.emitter.emit('invalidate', {
      typename: 'AnswerCollection',
      id: originalElement.answerCollectionId,
    })
  }

  return deletedElement
}

export async function removeElement(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  // verify that the user has a direct permission on the specified element
  const element = await ctx.prisma.element.findUnique({
    where: { id, directPermissions: { some: { userId: ctx.user.sub } } },
  })

  if (!element) {
    return null
  }

  // remove direct permission and recompute derived permissions for this element and user
  await ctx.prisma.$transaction(
    async (prisma) => {
      // remove the direct permission for the user on the element
      await prisma.element.update({
        where: { id },
        data: {
          directPermissions: {
            deleteMany: { userId: ctx.user.sub },
          },
        },
      })

      // create an audit log entry for the removal
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.PERMISSION_REMOVED,
          objectId: String(id),
          objectType: DB.ObjectType.ELEMENT,
          sourceUserId: ctx.user.sub,
          message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.ELEMENT} (ID: ${id})`,
        },
      })

      // recompute derived permissions for the element
      await recomputeDerivedPermissions(
        { elementId: id, userId: ctx.user.sub },
        prisma
      )
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'Element',
    id,
  })

  return String(id)
}

export async function editTag(
  { id, name }: { id: number; name: string },
  ctx: ContextWithUser
) {
  // check if the current user already has a tag with the new name
  const existingTag = await ctx.prisma.tag.findUnique({
    where: { ownerId_name: { ownerId: ctx.user.sub, name } },
  })

  // due to uniqueness constraint, no two tags with the same name can exist for one user
  if (existingTag) {
    return null
  }

  // update the tag as requested
  const tag = await ctx.prisma.tag.update({
    where: { id, ownerId: ctx.user.sub },
    data: { name },
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

export async function getUserMediaFiles(ctx: ContextWithUser) {
  const importExportEnabled = getImportExportRuntimeConfig().enabled
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.sub },
    include: {
      mediaFiles: {
        where: {
          OR: [
            { originalId: null },
            {
              AND: [
                {
                  NOT: {
                    originalId: {
                      startsWith: DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
                    },
                  },
                },
                {
                  NOT: {
                    originalId: {
                      startsWith: DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
                    },
                  },
                },
              ],
            },
          ],
          ...(importExportEnabled
            ? {
                importFingerprintVersion:
                  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return user?.mediaFiles ?? []
}

export async function getFileUploadSas(
  {
    fileName,
    contentType,
    requiresFinalization = false,
  }: {
    fileName: string
    contentType: string
    requiresFinalization?: boolean | null
  },
  ctx: ContextWithUser
) {
  const usesFinalizationProtocol = requiresFinalization === true
  if (!usesFinalizationProtocol && getImportExportRuntimeConfig().enabled) {
    throw new Error(
      'This media upload client must be refreshed before uploading files.'
    )
  }

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

  const fileExtension = SUPPORTED_MEDIA_CONTENT_TYPE_EXTENSIONS[contentType]
  if (!fileExtension) {
    throw new Error('Unsupported media content type.')
  }

  const id = randomUUID()
  const blobName = `${id}.${fileExtension}`
  const fileHref = `${storageAccount}/${ctx.user.sub}/${blobName}`

  // generate file upload SAS with blob storage service
  // Create-only access prevents the still-live SAS from overwriting bytes
  // after server-side fingerprint finalization.
  const permissions = BlobSASPermissions.parse('c')
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
      ...(usesFinalizationProtocol
        ? { originalId: createPendingDirectUploadOriginalId(id) }
        : {}),
    },
  })

  return {
    mediaFileId: id,
    uploadSasURL: `${storageAccount}?${queryParams}`,
    uploadHref: fileHref,
    containerName: ctx.user.sub,
    fileName: blobName,
  }
}

export async function finalizeFileUpload(
  { mediaFileId }: { mediaFileId: string },
  ctx: ContextWithUser
) {
  return await finalizeUploadedMediaFingerprintV1(
    { mediaFileId, ownerId: ctx.user.sub },
    ctx.prisma
  )
}

export async function getInstanceUpdateActivities(
  {
    elementId,
    hasSampleSolution,
    includeTemplateInstances,
  }: {
    elementId: number
    hasSampleSolution?: boolean | null
    includeTemplateInstances: boolean
  },
  ctx: ContextWithUser
) {
  // fetch meta information on all activities that would be affected by the element update
  // fetch the element and return null, if the element does not exist
  const acceptedStatusValues = includeTemplateInstances
    ? [
        DB.PublicationStatus.DRAFT,
        DB.PublicationStatus.SCHEDULED,
        DB.PublicationStatus.TEMPLATE,
      ]
    : [DB.PublicationStatus.DRAFT, DB.PublicationStatus.SCHEDULED]

  // only activities where the user has at least WRITE permissions should be updated
  const requiredActivityAccess: DB.PermissionLevel[] = [
    DB.PermissionLevel.WRITE,
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ]

  const element = await ctx.prisma.element.findUnique({
    where: { id: elementId },
    include: {
      elementInstances: {
        include: {
          elementStack: {
            include: {
              microLearning: {
                where: {
                  status: { in: acceptedStatusValues },
                  // only activities where the user has at least WRITE permissions should be updated
                  permissions: {
                    some: {
                      userId: ctx.user.sub,
                      permissionLevel: {
                        in: requiredActivityAccess,
                      },
                    },
                  },
                },
              },
              practiceQuiz: {
                where: {
                  status: { in: acceptedStatusValues },
                  // only activities where the user has at least WRITE permissions should be updated
                  permissions: {
                    some: {
                      userId: ctx.user.sub,
                      permissionLevel: {
                        in: requiredActivityAccess,
                      },
                    },
                  },
                },
              },
              groupActivity: {
                where: {
                  status: { in: acceptedStatusValues },
                  // only activities where the user has at least WRITE permissions should be updated
                  permissions: {
                    some: {
                      userId: ctx.user.sub,
                      permissionLevel: {
                        in: requiredActivityAccess,
                      },
                    },
                  },
                },
              },
            },
          },
          // ? where clause is not accepted by prisma for unknown reasons
          elementBlock: {
            include: { liveQuiz: { include: { permissions: true } } },
          },
        },
      },
    },
  })

  if (!element) {
    return []
  }

  // element instances in practice quizzes and microlearnings are only updated
  // with sample solution defined (except for CT, FC and FT elements)
  const asynchronousActivityValid =
    element.type === DB.ElementType.FLASHCARD ||
    element.type === DB.ElementType.CONTENT ||
    element.type === DB.ElementType.FREE_TEXT ||
    hasSampleSolution

  // combine instances that are to be updated
  const instancesToBeUpdated = element.elementInstances.reduce<
    {
      activityName: string
      activityType: ActivityType
      status: DB.PublicationStatus
    }[]
  >((acc, instance) => {
    if (
      (instance.elementBlock?.liveQuiz?.status === DB.PublicationStatus.DRAFT ||
        instance.elementBlock?.liveQuiz?.status ===
          DB.PublicationStatus.SCHEDULED ||
        (includeTemplateInstances &&
          instance.elementBlock?.liveQuiz?.status ===
            DB.PublicationStatus.TEMPLATE)) &&
      // ensure that user has at least WRITE permissions on activity (cannot be checked with where clause above)
      instance.elementBlock.liveQuiz.permissions
        .filter((permission) => permission.userId === ctx.user.sub)
        .some((permission) =>
          requiredActivityAccess.includes(permission.permissionLevel)
        )
    ) {
      acc.push({
        activityName: instance.elementBlock.liveQuiz.name,
        activityType: ActivityType.LIVE_QUIZ,
        status: instance.elementBlock.liveQuiz.status,
      })

      return acc
    } else if (
      (instance.elementStack?.microLearning?.status ===
        DB.PublicationStatus.DRAFT ||
        instance.elementStack?.microLearning?.status ===
          DB.PublicationStatus.SCHEDULED ||
        (includeTemplateInstances &&
          instance.elementStack?.microLearning?.status ===
            DB.PublicationStatus.TEMPLATE)) &&
      asynchronousActivityValid
    ) {
      acc.push({
        activityName: instance.elementStack.microLearning.name,
        activityType: ActivityType.MICRO_LEARNING,
        status: instance.elementStack.microLearning.status,
      })

      return acc
    } else if (
      (instance.elementStack?.practiceQuiz?.status ===
        DB.PublicationStatus.DRAFT ||
        instance.elementStack?.practiceQuiz?.status ===
          DB.PublicationStatus.SCHEDULED ||
        (includeTemplateInstances &&
          instance.elementStack?.practiceQuiz?.status ===
            DB.PublicationStatus.TEMPLATE)) &&
      asynchronousActivityValid
    ) {
      acc.push({
        activityName: instance.elementStack.practiceQuiz.name,
        activityType: ActivityType.PRACTICE_QUIZ,
        status: instance.elementStack.practiceQuiz.status,
      })

      return acc
    } else if (
      instance.elementStack?.groupActivity?.status ===
        DB.PublicationStatus.DRAFT ||
      instance.elementStack?.groupActivity?.status ===
        DB.PublicationStatus.SCHEDULED ||
      (includeTemplateInstances &&
        instance.elementStack?.groupActivity?.status ===
          DB.PublicationStatus.TEMPLATE)
    ) {
      acc.push({
        activityName: instance.elementStack.groupActivity.name,
        activityType: ActivityType.GROUP_ACTIVITY,
        status: instance.elementStack.groupActivity.status,
      })

      return acc
    }

    return acc
  }, [])

  return uniqueBy(
    sortBy(
      instancesToBeUpdated,
      [prop('activityType'), 'desc'],
      [prop('activityName'), 'asc']
    ),
    prop('activityName')
  )
}

export async function getElementSummary(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const levels = [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER]
  const element = await ctx.prisma.element.findUnique({
    where: { id },
    include: {
      answerCollection: {
        include: {
          permissions: {
            where: {
              userId: ctx.user.sub,
              permissionLevel: { not: DB.PermissionLevel.OWNER },
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
                      permissionLevel: { in: levels },
                    },
                  },
                },
              },
              practiceQuiz: {
                include: {
                  permissions: {
                    where: {
                      userId: ctx.user.sub,
                      permissionLevel: { in: levels },
                    },
                  },
                },
              },
              groupActivity: {
                include: {
                  permissions: {
                    where: {
                      userId: ctx.user.sub,
                      permissionLevel: { in: levels },
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
                      permissionLevel: { in: levels },
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

  if (!element) {
    return null
  }

  const sharedElementActivityUse =
    element.elementInstances.filter(
      (instance) => instance.ownerId !== ctx.user.sub
    ).length > 0
  const retainsDerivedAccess = element.elementInstances.some(
    (instance) =>
      (instance.elementStack?.microLearning?.permissions.length ?? 0) > 0 ||
      (instance.elementStack?.practiceQuiz?.permissions.length ?? 0) > 0 ||
      (instance.elementStack?.groupActivity?.permissions.length ?? 0) > 0 ||
      (instance.elementBlock?.liveQuiz?.permissions.length ?? 0) > 0
  )
  const derivedAccessToResources =
    (element.answerCollection?.permissions.length ?? 0) > 0

  return {
    sharedElementActivityUse,
    retainsDerivedAccess,
    derivedAccessToResources,
  }
}

export async function getOutdatedElementInstances(
  { instanceIds }: { instanceIds: number[] },
  ctx: ContextWithUser
) {
  if (instanceIds.length === 0) {
    return []
  }

  // fetch all used elements
  const dbInstances = await ctx.prisma.elementInstance.findMany({
    where: { id: { in: instanceIds }, element: { isDeleted: false } },
    include: {
      element: {
        select: { id: true, version: true, name: true, options: true },
      },
    },
  })

  // check if any of the instances has an outdated element version
  const { outdatedInstances } = dbInstances.reduce<{
    outdatedInstances: {
      id: number
      newTitle: string
      newSampleSolution: boolean
    }[]
  }>(
    (acc, instance) => {
      const [_, instanceVersion] = instance.elementData.id.split('-v')

      if (
        instanceVersion &&
        instance.element &&
        parseInt(instanceVersion) < instance.element.version
      ) {
        acc.outdatedInstances.push({
          id: instance.id,
          newTitle: instance.element.name,
          newSampleSolution:
            instance.element.options &&
            'hasSampleSolution' in instance.element.options
              ? (instance.element.options?.hasSampleSolution ?? false)
              : false,
        })
      }

      return acc
    },
    { outdatedInstances: [] }
  )

  return outdatedInstances
}

export async function updateElementInstances(
  {
    elementId,
    includeTemplates,
  }: { elementId: number; includeTemplates: boolean },
  prisma: PrismaTransactionClient,
  emitter: EventEmitter,
  userId: string
) {
  // fetch the element and return null, if the element does not exist
  const acceptedStatusValues = includeTemplates
    ? [
        DB.PublicationStatus.DRAFT,
        DB.PublicationStatus.SCHEDULED,
        DB.PublicationStatus.TEMPLATE,
      ]
    : [DB.PublicationStatus.DRAFT, DB.PublicationStatus.SCHEDULED]

  // only activities where the user has at least WRITE permissions should be updated
  const requiredActivityAccess: DB.PermissionLevel[] = [
    DB.PermissionLevel.WRITE,
    DB.PermissionLevel.ADMIN,
    DB.PermissionLevel.OWNER,
  ]

  const element = await prisma.element.findUnique({
    where: {
      id: elementId,
      isDeleted: false,
    },
    include: {
      elementInstances: {
        include: {
          elementStack: {
            include: {
              microLearning: {
                where: {
                  status: { in: acceptedStatusValues },
                  // only activities where the user has at least WRITE permissions should be updated
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
                  // only activities where the user has at least WRITE permissions should be updated
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
                  // only activities where the user has at least WRITE permissions should be updated
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
              // ? where clause is not accepted by prisma for unknown reasons
              liveQuiz: { include: { templateInfo: true, permissions: true } },
            },
          },
        },
      },
      answerCollection: {
        include: {
          entries: true,
        },
      },
      answerCollectionItems: true,
    },
  })

  if (!element) {
    return []
  }

  // check if a sample solution is defined or if the element type does not require sample solutions
  // in asynchronous activities to avoid updating and invalidating corresponding instances
  const asynchronousActivityValid =
    element.type === DB.ElementType.FLASHCARD ||
    element.type === DB.ElementType.CONTENT ||
    element.type === DB.ElementType.FREE_TEXT ||
    ('hasSampleSolution' in element.options &&
      element.options.hasSampleSolution)

  // get all instances and the corresponding element multipliers
  const instanceData = element.elementInstances.reduce<
    {
      instanceId: number
      multiplier: number
      liveQuizId: string | undefined
      practiceQuizId: string | undefined
      microLearningId: string | undefined
      groupActivityId: string | undefined
      templateId: string | undefined
      reviewStatus: DB.ReviewStatus | undefined
    }[]
  >((acc, instance) => {
    if (
      (instance.elementBlock?.liveQuiz?.status === DB.PublicationStatus.DRAFT ||
        instance.elementBlock?.liveQuiz?.status ===
          DB.PublicationStatus.SCHEDULED ||
        (includeTemplates &&
          instance.elementBlock?.liveQuiz?.status ===
            DB.PublicationStatus.TEMPLATE)) &&
      // ensure that user has at least WRITE permissions on activity (cannot be checked with where clause above)
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
        practiceQuizId: undefined,
        microLearningId: undefined,
        groupActivityId: undefined,
        templateId: instance.elementBlock.liveQuiz.templateInfo?.id,
        reviewStatus: instance.elementBlock.liveQuiz.reviewStatus,
      })

      return acc
    } else if (
      instance.elementStack?.microLearning &&
      asynchronousActivityValid
    ) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementStack.microLearning.pointsMultiplier,
        liveQuizId: undefined,
        practiceQuizId: undefined,
        microLearningId: instance.elementStack.microLearning.id,
        groupActivityId: undefined,
        templateId: instance.elementStack.microLearning.templateInfo?.id,
        reviewStatus: instance.elementStack.microLearning.reviewStatus,
      })

      return acc
    } else if (
      instance.elementStack?.practiceQuiz &&
      asynchronousActivityValid
    ) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementStack.practiceQuiz.pointsMultiplier,
        liveQuizId: undefined,
        practiceQuizId: instance.elementStack.practiceQuiz.id,
        microLearningId: undefined,
        groupActivityId: undefined,
        templateId: instance.elementStack.practiceQuiz.templateInfo?.id,
        reviewStatus: instance.elementStack.practiceQuiz.reviewStatus,
      })

      return acc
    } else if (instance.elementStack?.groupActivity) {
      acc.push({
        instanceId: instance.id,
        multiplier: instance.elementStack.groupActivity.pointsMultiplier,
        liveQuizId: undefined,
        practiceQuizId: undefined,
        microLearningId: undefined,
        groupActivityId: instance.elementStack.groupActivity.id,
        templateId: instance.elementStack.groupActivity.templateInfo?.id,
        reviewStatus: instance.elementStack.groupActivity.reviewStatus,
      })

      return acc
    }

    return acc
  }, [])

  // keep track of answer collections for which the assignment / link to a template was modified
  // --> update of derived permissions is required
  let touchedAnswerCollectionIds: number[] = []

  // execute the instance updates
  const updatedInstances = (
    await Promise.allSettled(
      Object.values(instanceData).map(
        async ({
          instanceId,
          multiplier,
          liveQuizId,
          practiceQuizId,
          microLearningId,
          groupActivityId,
          templateId,
          reviewStatus,
        }) => {
          const oldInstance = await prisma.elementInstance.findUnique({
            where: { id: instanceId },
          })

          if (!oldInstance) return null

          // prepare new element data objects
          const newElementData = processElementData(element)

          // prepare new results objects
          const newResults = getInitialInstanceResults(newElementData)

          const instance = await prisma.elementInstance.update({
            where: { id: instanceId },
            data: {
              elementData: newElementData,
              results: newResults,
              anonymousResults: newResults,
              // keep previous options where possible and update them only where required
              options: {
                ...oldInstance.options,
                basePoints: element.basePoints,
                pointsMultiplier: multiplier * element.pointsMultiplier,
              },
            },
          })

          // if the previous activity status was set to reviewed, update it to indicated that the content was modified
          if (reviewStatus === DB.ReviewStatus.REVIEWED) {
            if (typeof liveQuizId !== 'undefined') {
              await prisma.liveQuiz.update({
                where: { id: liveQuizId },
                data: { reviewStatus: DB.ReviewStatus.MODIFIED_AFTER_REVIEW },
              })
            } else if (typeof practiceQuizId !== 'undefined') {
              await prisma.practiceQuiz.update({
                where: { id: practiceQuizId },
                data: { reviewStatus: DB.ReviewStatus.MODIFIED_AFTER_REVIEW },
              })
            } else if (typeof microLearningId !== 'undefined') {
              await prisma.microLearning.update({
                where: { id: microLearningId },
                data: { reviewStatus: DB.ReviewStatus.MODIFIED_AFTER_REVIEW },
              })
            } else if (typeof groupActivityId !== 'undefined') {
              await prisma.groupActivity.update({
                where: { id: groupActivityId },
                data: { reviewStatus: DB.ReviewStatus.MODIFIED_AFTER_REVIEW },
              })
            }
          }

          if (
            includeTemplates &&
            typeof templateId !== 'undefined' &&
            (element.type === DB.ElementType.SELECTION ||
              element.type === DB.ElementType.CASE_STUDY) &&
            element.answerCollectionId !== null
          ) {
            // get all answer collections and answer collection entries used in any instance in the affected template
            let instanceCollectionIds: number[] = []
            let instanceCollectionEntryIds: number[] = []

            if (typeof liveQuizId !== 'undefined') {
              const {
                answerCollectionIds: ids,
                answerCollectionEntryIds: entryIds,
              } = await getActivityAnswerCollectionIds(
                {
                  activityId: liveQuizId,
                  activityType: ActivityType.LIVE_QUIZ,
                },
                prisma
              )

              instanceCollectionIds = ids
              instanceCollectionEntryIds = entryIds
            } else if (typeof practiceQuizId !== 'undefined') {
              const {
                answerCollectionIds: ids,
                answerCollectionEntryIds: entryIds,
              } = await getActivityAnswerCollectionIds(
                {
                  activityId: practiceQuizId,
                  activityType: ActivityType.PRACTICE_QUIZ,
                },
                prisma
              )

              instanceCollectionIds = ids
              instanceCollectionEntryIds = entryIds
            } else if (typeof microLearningId !== 'undefined') {
              const {
                answerCollectionIds: ids,
                answerCollectionEntryIds: entryIds,
              } = await getActivityAnswerCollectionIds(
                {
                  activityId: microLearningId,
                  activityType: ActivityType.MICRO_LEARNING,
                },
                prisma
              )

              instanceCollectionIds = ids
              instanceCollectionEntryIds = entryIds
            } else if (typeof groupActivityId !== 'undefined') {
              const {
                answerCollectionIds: ids,
                answerCollectionEntryIds: entryIds,
              } = await getActivityAnswerCollectionIds(
                {
                  activityId: groupActivityId,
                  activityType: ActivityType.GROUP_ACTIVITY,
                },
                prisma
              )

              instanceCollectionIds = ids
              instanceCollectionEntryIds = entryIds
            }

            // fetch the existing template and the contained answer collections
            const template = await prisma.activityTemplate.findUnique({
              where: {
                id: templateId,
              },
              include: {
                answerCollections: true,
                answerCollectionItems: true,
              },
            })

            if (!template) {
              return null
            }

            // find answer collections that should be connected and or disconnected from the template
            const templateCollectionIds = template.answerCollections.map(
              (collection) => collection.id
            )
            const collectionsToDisconnect = templateCollectionIds.filter(
              (id) => !instanceCollectionIds.includes(id)
            )
            const collectionsToConnect = instanceCollectionIds.filter(
              (id) => !templateCollectionIds.includes(id)
            )

            const templateCollectionEntryIds =
              template.answerCollectionItems.map((collection) => collection.id)
            const collectionEntriesToDisconnect =
              templateCollectionEntryIds.filter(
                (id) => !instanceCollectionEntryIds.includes(id)
              )
            const collectionEntriesToConnect =
              instanceCollectionEntryIds.filter(
                (id) => !templateCollectionEntryIds.includes(id)
              )

            // add all answer collections that were added or removed to the touched ones for a derived permissions update
            touchedAnswerCollectionIds = touchedAnswerCollectionIds.concat([
              ...collectionsToDisconnect,
              ...collectionsToConnect,
            ])

            // check if the list of answer collection ids in the template and the ones used in the instance coincide, otherwise update these links
            if (
              collectionsToConnect.length > 0 ||
              collectionsToDisconnect.length > 0 ||
              collectionEntriesToConnect.length > 0 ||
              collectionEntriesToDisconnect.length > 0
            ) {
              await prisma.activityTemplate.update({
                where: {
                  id: templateId,
                },
                data: {
                  answerCollections:
                    collectionsToConnect.length > 0 ||
                    collectionsToDisconnect.length > 0
                      ? {
                          connect:
                            collectionsToConnect.length > 0
                              ? collectionsToConnect.map((id) => ({
                                  id,
                                }))
                              : [],
                          disconnect:
                            collectionsToDisconnect.length > 0
                              ? collectionsToDisconnect.map((id) => ({
                                  id,
                                }))
                              : [],
                        }
                      : undefined,
                  answerCollectionItems:
                    collectionEntriesToConnect.length > 0 ||
                    collectionEntriesToDisconnect.length > 0
                      ? {
                          connect:
                            collectionEntriesToConnect.length > 0
                              ? collectionEntriesToConnect.map((id) => ({
                                  id,
                                }))
                              : [],
                          disconnect:
                            collectionEntriesToDisconnect.length > 0
                              ? collectionEntriesToDisconnect.map((id) => ({
                                  id,
                                }))
                              : [],
                        }
                      : undefined,
                },
              })
            }
          }

          if (!instance) return null

          if (typeof liveQuizId !== 'undefined') {
            emitter.emit('invalidate', {
              typename: 'LiveQuiz',
              id: liveQuizId,
            })
          } else if (typeof practiceQuizId !== 'undefined') {
            emitter.emit('invalidate', {
              typename: 'PracticeQuiz',
              id: practiceQuizId,
            })
          } else if (typeof microLearningId !== 'undefined') {
            emitter.emit('invalidate', {
              typename: 'MicroLearning',
              id: microLearningId,
            })
          } else if (typeof groupActivityId !== 'undefined') {
            emitter.emit('invalidate', {
              typename: 'GroupActivity',
              id: groupActivityId,
            })
          } else if (typeof templateId !== 'undefined') {
            emitter.emit('invalidate', {
              typename: 'Template',
              id: templateId,
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

  if (includeTemplates) {
    // reduce the list of touched answer collections to unique values
    const uniqueTouchedAnswerCollectionIds = [
      ...new Set(touchedAnswerCollectionIds),
    ]

    // recompute the derived permissions for all touched answer collections
    for (const id of uniqueTouchedAnswerCollectionIds) {
      await recomputeDerivedPermissions({ answerCollectionId: id }, prisma)
    }
  }

  // mark all instances as outdated that are no longer in sync with the element version
  await flagOutdatedElementInstances({ elementId }, prisma, emitter)

  return updatedInstances
}

export async function flagOutdatedElementInstances(
  { elementId }: { elementId: number },
  prisma: PrismaTransactionClient,
  emitter: EventEmitter
) {
  // fetch the element to check the latest version
  const element = await prisma.element.findUnique({
    where: { id: elementId, isDeleted: false },
  })

  if (!element) {
    return false
  }

  // fetch all element instances with outdated element versions
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
    // set the element instance version to outdated
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: { isVersionOutdated: true },
    })

    // highlight on the activity that it contains outdated elements
    if (instance.elementBlock?.liveQuizId) {
      await prisma.liveQuiz.update({
        where: { id: instance.elementBlock.liveQuizId },
        data: { areInstancesOutdated: true },
      })

      emitter.emit('invalidate', {
        typename: 'LiveQuiz',
        id: instance.elementBlock.liveQuizId,
      })
    } else if (instance.elementStack?.microLearningId) {
      await prisma.microLearning.update({
        where: { id: instance.elementStack.microLearningId },
        data: { areInstancesOutdated: true },
      })

      emitter.emit('invalidate', {
        typename: 'MicroLearning',
        id: instance.elementStack.microLearningId,
      })
    } else if (instance.elementStack?.practiceQuizId) {
      await prisma.practiceQuiz.update({
        where: { id: instance.elementStack.practiceQuizId },
        data: { areInstancesOutdated: true },
      })

      emitter.emit('invalidate', {
        typename: 'PracticeQuiz',
        id: instance.elementStack.practiceQuizId,
      })
    } else if (instance.elementStack?.groupActivityId) {
      await prisma.groupActivity.update({
        where: { id: instance.elementStack.groupActivityId },
        data: { areInstancesOutdated: true },
      })

      emitter.emit('invalidate', {
        typename: 'GroupActivity',
        id: instance.elementStack.groupActivityId,
      })
    }
  }

  return true
}
