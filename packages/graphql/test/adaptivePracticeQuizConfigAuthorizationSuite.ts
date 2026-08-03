import { prisma } from '@klicker-uzh/prisma'
import { PermissionLevel, PublicationStatus } from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { getAdaptivePracticeQuizPreview } from '../src/services/adaptivePracticeQuizConfig.js'
import { lockAdaptivePracticeQuizPublicationSources } from '../src/services/adaptivePracticeQuizPublicationAuthorization.js'
import {
  archiveCompetenceTree,
  deleteCompetenceTree,
} from '../src/services/competenceTreeManagement.js'
import { publishPracticeQuiz } from '../src/services/practiceQuizzes.js'
import {
  removeUserFromGroup,
  revokeObjectAccess,
} from '../src/services/sharing.js'

const owner = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'adaptive-owner@example.com',
  shortname: 'adaptive-owner',
}
const reader = {
  id: '10000000-0000-4000-8000-000000000002',
  email: 'adaptive-reader@example.com',
  shortname: 'adaptive-reader',
}
const outsider = {
  id: '10000000-0000-4000-8000-000000000003',
  email: 'adaptive-outsider@example.com',
  shortname: 'adaptive-outsider',
}

import {
  cleanup,
  contextFor,
  createAdaptiveQuiz,
  createCourse,
  createTreeFixture,
  waitForElementPermissionRevocationLock,
} from './adaptivePracticeQuizConfigTestSupport.js'

export function registerAdaptivePracticeQuizConfigAuthorizationTests() {
  let ownerCtx: ContextWithUser
  let readerCtx: ContextWithUser
  let outsiderCtx: ContextWithUser
  let scheduledTaskDelete: ReturnType<typeof vi.fn>
  let scheduledTaskCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    await cleanup()
    await prisma.user.createMany({ data: [owner, reader, outsider] })

    scheduledTaskDelete = vi.fn().mockResolvedValue(undefined)
    scheduledTaskCreate = vi.fn().mockResolvedValue({
      metadata: { id: 'adaptive-publication-task' },
    })
    ownerCtx = contextFor(owner.id, scheduledTaskCreate, scheduledTaskDelete)
    readerCtx = contextFor(reader.id, scheduledTaskCreate, scheduledTaskDelete)
    outsiderCtx = contextFor(
      outsider.id,
      scheduledTaskCreate,
      scheduledTaskDelete
    )
  })

  afterEach(cleanup)

  it('revalidates tree-owner access and preserves an authorized snapshot after revocation', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'revoked-source-adaptive-quiz',
    })
    const sourceElementId = fixture.elementIds[0]!
    await prisma.element.update({
      where: { id: sourceElementId },
      data: { ownerId: reader.id },
    })
    const permission = await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userId: owner.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )

    await expect(
      getAdaptivePracticeQuizPreview({ id: quiz.id }, ownerCtx)
    ).resolves.toMatchObject({ readiness: { ready: true } })

    await revokeObjectAccess(
      { permissionId: permission.id, elementId: sourceElementId },
      readerCtx
    )
    const preview = await getAdaptivePracticeQuizPreview(
      { id: quiz.id },
      ownerCtx
    )
    expect(preview?.assignments).toContainEqual(
      expect.objectContaining({
        elementId: sourceElementId,
        available: false,
        availabilityReason: 'OWNER_ACCESS_REVOKED',
      })
    )
    expect(preview?.readiness.errors).toContainEqual(
      expect.objectContaining({ code: 'ADAPTIVE_ITEM_ACCESS_REVOKED' })
    )
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })

    const restoredPermission = await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userId: owner.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )

    let releasePublicationLock!: () => void
    let markPublicationLocked!: () => void
    const publicationLocked = new Promise<void>((resolve) => {
      markPublicationLocked = resolve
    })
    const releasePublication = new Promise<void>((resolve) => {
      releasePublicationLock = resolve
    })
    const publicationBlocker = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
        SELECT "id"
        FROM "Element"
        WHERE "id" = ${sourceElementId}
        FOR SHARE
      `
        markPublicationLocked()
        await releasePublication
      },
      { timeout: 10_000 }
    )
    await publicationLocked

    const postPublicationRevocation = revokeObjectAccess(
      {
        permissionId: restoredPermission.id,
        elementId: sourceElementId,
      },
      readerCtx
    )
    const revocationState = await Promise.race([
      postPublicationRevocation.then(() => 'fulfilled'),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 100)
      ),
    ])
    try {
      await expect(
        publishPracticeQuiz({ id: quiz.id }, ownerCtx)
      ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    } finally {
      releasePublicationLock()
    }
    await publicationBlocker
    await expect(postPublicationRevocation).resolves.toBe(restoredPermission.id)
    expect(revocationState).toBe('pending')
    const authorizedPool = await prisma.practiceQuizAdaptivePoolItem.findMany({
      where: { config: { practiceQuizId: quiz.id } },
      orderBy: { sourceAssignmentId: 'asc' },
    })
    expect(authorizedPool).toHaveLength(20)
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.findMany({
        where: { config: { practiceQuizId: quiz.id } },
        orderBy: { sourceAssignmentId: 'asc' },
      })
    ).toEqual(authorizedPool)
  })

  it('serializes source-access revocation before concurrent publication', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'concurrent-revocation-adaptive-quiz',
    })
    const sourceElementId = fixture.elementIds[0]!
    await prisma.element.update({
      where: { id: sourceElementId },
      data: { ownerId: reader.id },
    })
    const permission = await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userId: owner.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )

    let releasePermissionLock!: () => void
    let markPermissionLocked!: () => void
    const permissionLocked = new Promise<void>((resolve) => {
      markPermissionLocked = resolve
    })
    const releasePermission = new Promise<void>((resolve) => {
      releasePermissionLock = resolve
    })
    const permissionBlocker = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
        SELECT "id"
        FROM "Permission"
        WHERE "id" = ${permission.id}
        FOR UPDATE
      `
        markPermissionLocked()
        await releasePermission
      },
      { timeout: 10_000 }
    )
    await permissionLocked

    const revocation = revokeObjectAccess(
      { permissionId: permission.id, elementId: sourceElementId },
      readerCtx
    )
    let publication!: ReturnType<typeof publishPracticeQuiz>
    let publicationState = 'not-started'
    try {
      await waitForElementPermissionRevocationLock(sourceElementId)
      publication = publishPracticeQuiz({ id: quiz.id }, ownerCtx)
      publicationState = await Promise.race([
        publication.then(
          () => 'fulfilled',
          () => 'rejected'
        ),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 100)
        ),
      ])
    } finally {
      releasePermissionLock()
    }

    await permissionBlocker
    await expect(revocation).resolves.toBe(permission.id)
    await expect(publication).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(publicationState).toBe('pending')
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })
  })

  it('serializes group-based source-access removal with publication authorization', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'group-revocation-adaptive-quiz',
    })
    const sourceElementId = fixture.elementIds[0]!
    await prisma.element.update({
      where: { id: sourceElementId },
      data: { ownerId: reader.id },
    })
    const group = await prisma.userGroup.create({
      data: {
        name: `adaptive-source-group-${crypto.randomUUID()}`,
        ownerId: reader.id,
        members: { connect: { id: owner.id } },
      },
    })
    await prisma.permission.create({
      data: {
        elementId: sourceElementId,
        userGroupId: group.id,
        permissionLevel: PermissionLevel.READ,
      },
    })
    await recomputeDerivedPermissions(
      {
        elementId: sourceElementId,
        userId: owner.id,
        updateAccessRequests: false,
      },
      prisma
    )
    let releasePublicationAuthorizationLock!: () => void
    let markPublicationAuthorizationLocked!: () => void
    const publicationAuthorizationLocked = new Promise<void>((resolve) => {
      markPublicationAuthorizationLocked = resolve
    })
    const releasePublicationAuthorization = new Promise<void>((resolve) => {
      releasePublicationAuthorizationLock = resolve
    })
    const publicationAuthorizationTransaction = prisma.$transaction(
      async (tx) => {
        await lockAdaptivePracticeQuizPublicationSources(quiz.id, tx)
        markPublicationAuthorizationLocked()
        await releasePublicationAuthorization
      },
      { timeout: 10_000 }
    )
    await publicationAuthorizationLocked

    const groupRemoval = removeUserFromGroup(
      { groupId: group.id, userId: owner.id },
      readerCtx
    )
    const removalState = await Promise.race([
      groupRemoval.then(() => 'fulfilled'),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 100)
      ),
    ])
    releasePublicationAuthorizationLock()

    await publicationAuthorizationTransaction
    await expect(groupRemoval).resolves.toBe(true)
    expect(removalState).toBe('pending')
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_SOURCE_ELEMENT_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
  })

  it.each([
    'archive',
    'delete',
  ] as const)('serializes competence-tree %s with publication authorization', async (stateChange) => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: `${stateChange}-tree-publication-adaptive-quiz`,
    })

    let releasePublicationAuthorizationLock!: () => void
    let markPublicationAuthorizationLocked!: () => void
    const publicationAuthorizationLocked = new Promise<void>((resolve) => {
      markPublicationAuthorizationLocked = resolve
    })
    const releasePublicationAuthorization = new Promise<void>((resolve) => {
      releasePublicationAuthorizationLock = resolve
    })
    const publicationAuthorizationTransaction = prisma.$transaction(
      async (tx) => {
        await lockAdaptivePracticeQuizPublicationSources(quiz.id, tx)
        markPublicationAuthorizationLocked()
        await releasePublicationAuthorization
      },
      { timeout: 10_000 }
    )
    await publicationAuthorizationLocked

    const treeStateChange =
      stateChange === 'archive'
        ? archiveCompetenceTree({ id: fixture.treeId }, ownerCtx)
        : deleteCompetenceTree({ id: fixture.treeId }, ownerCtx)
    const stateChangeResult = await Promise.race([
      treeStateChange.then(() => 'fulfilled'),
      new Promise<'pending'>((resolve) =>
        setTimeout(() => resolve('pending'), 100)
      ),
    ])
    releasePublicationAuthorizationLock()

    await publicationAuthorizationTransaction
    await expect(treeStateChange).resolves.toBe(true)
    expect(stateChangeResult).toBe('pending')
    await expect(
      publishPracticeQuiz({ id: quiz.id }, ownerCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE' },
    })
    expect(
      await prisma.practiceQuizAdaptivePoolItem.count({
        where: { config: { practiceQuizId: quiz.id } },
      })
    ).toBe(0)
    expect(
      await prisma.practiceQuiz.findUniqueOrThrow({ where: { id: quiz.id } })
    ).toMatchObject({ status: PublicationStatus.DRAFT })
  })

  it('lets a quiz manager publish a linked tree without granting element access', async () => {
    const course = await createCourse(owner.id)
    const fixture = await createTreeFixture(course.id, ownerCtx)
    const quiz = await createAdaptiveQuiz({
      courseId: course.id,
      fixture,
      ctx: ownerCtx,
      name: 'manager-publication-adaptive-quiz',
    })
    await prisma.derivedPermission.create({
      data: {
        practiceQuizId: quiz.id,
        userId: outsider.id,
        permissionLevel: PermissionLevel.ADMIN,
      },
    })
    const resolver = schema.getMutationType()!.getFields().publishPracticeQuiz!
      .resolve!

    await expect(
      resolver({}, { id: quiz.id, availableFrom: null }, outsiderCtx, {
        fieldName: 'publishPracticeQuiz',
      } as never)
    ).resolves.toMatchObject({ status: PublicationStatus.PUBLISHED })
    expect(
      await prisma.derivedPermission.count({
        where: {
          userId: outsider.id,
          elementId: { in: fixture.elementIds },
        },
      })
    ).toBe(0)
  })
}
