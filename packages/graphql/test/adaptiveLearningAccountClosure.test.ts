import { prisma } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import {
  assertAdaptiveLearningAccountClosureReady,
  getAdaptiveLearningAccountClosurePreflight,
  transferAdaptiveLearningCompetenceTrees,
} from '../src/services/adaptiveLearningAccountClosure.js'

describe('adaptive learning account closure', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "Participant" RESTART IDENTITY CASCADE'
    )
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('blocks account deletion and reports every owned competence tree', async () => {
    const { sourceUserId } = await createOwnershipFixture()

    const preflight = await getAdaptiveLearningAccountClosurePreflight(
      sourceUserId,
      prisma
    )

    expect(preflight).toMatchObject({
      userId: sourceUserId,
      ready: false,
      blockingTreeCount: 2,
      linkedCourseCount: 0,
      adaptiveConfigCount: 0,
      attemptCount: 0,
    })
    expect(preflight.ownedTrees.map(({ name }) => name).sort()).toEqual([
      'account-closure-tree-a',
      'account-closure-tree-b',
    ])
    expect(() => assertAdaptiveLearningAccountClosureReady(preflight)).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: 'ADAPTIVE_TREE_TRANSFER_REQUIRED',
          blockingTreeCount: 2,
        }),
      })
    )
    await expect(
      prisma.user.delete({ where: { id: sourceUserId } })
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('transfers ownership once, audits each tree, and clears the preflight', async () => {
    const { sourceUserId, targetUserId, treeIds } =
      await createOwnershipFixture()

    const firstTransfer = await prisma.$transaction((tx) =>
      transferAdaptiveLearningCompetenceTrees(
        {
          sourceUserId,
          targetUserId,
          actorUserId: sourceUserId,
        },
        tx
      )
    )
    const repeatedTransfer = await prisma.$transaction((tx) =>
      transferAdaptiveLearningCompetenceTrees(
        {
          sourceUserId,
          targetUserId,
          actorUserId: sourceUserId,
        },
        tx
      )
    )

    expect(firstTransfer.map(({ id }) => id).sort()).toEqual(treeIds.sort())
    expect(repeatedTransfer).toEqual([])
    await expect(
      prisma.competenceTree.count({ where: { ownerId: targetUserId } })
    ).resolves.toBe(2)

    const auditEntries = await prisma.auditLogEntry.findMany({
      where: {
        objectType: DB.ObjectType.COMPETENCE_TREE,
        objectId: { in: treeIds },
      },
      orderBy: { objectId: 'asc' },
    })
    expect(auditEntries).toHaveLength(2)
    expect(auditEntries).toEqual(
      expect.arrayContaining(
        treeIds.map((treeId) =>
          expect.objectContaining({
            type: DB.AuditLogType.OWNER_TRANSFERRED,
            objectType: DB.ObjectType.COMPETENCE_TREE,
            objectId: treeId,
            sourceUserId,
            targetUserId,
          })
        )
      )
    )

    const preflight = await getAdaptiveLearningAccountClosurePreflight(
      sourceUserId,
      prisma
    )
    expect(preflight).toMatchObject({
      ready: true,
      blockingTreeCount: 0,
      ownedTrees: [],
    })
    expect(() =>
      assertAdaptiveLearningAccountClosureReady(preflight)
    ).not.toThrow()
    await expect(
      prisma.user.delete({ where: { id: sourceUserId } })
    ).resolves.toMatchObject({ id: sourceUserId })
  })

  it('expires outstanding calibration exports before transferring a tree', async () => {
    const { sourceUserId, targetUserId, treeIds } =
      await createOwnershipFixture()
    const scale = await prisma.competenceTreeScaleVersion.create({
      data: {
        treeId: treeIds[0]!,
        version: 1,
        createdById: sourceUserId,
      },
    })
    const request = await prisma.adaptiveCalibrationExportRequest.create({
      data: {
        treeId: treeIds[0]!,
        scaleVersionId: scale.id,
        datasetVersion: 'account-closure-v1',
        requestedById: sourceUserId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    })

    const transferStartedAt = Date.now()
    await prisma.$transaction((tx) =>
      transferAdaptiveLearningCompetenceTrees(
        { sourceUserId, targetUserId, actorUserId: sourceUserId },
        tx
      )
    )

    const invalidated =
      await prisma.adaptiveCalibrationExportRequest.findUniqueOrThrow({
        where: { id: request.id },
      })
    expect(invalidated.expiresAt.getTime()).toBeGreaterThanOrEqual(
      transferStartedAt
    )
    expect(invalidated.expiresAt.getTime()).toBeLessThanOrEqual(
      transferStartedAt + 5_000
    )
  })
})

async function createOwnershipFixture() {
  const [source, target] = await Promise.all([
    prisma.user.create({
      data: {
        email: `adaptive-source-${randomUUID()}@example.com`,
        shortname: `adaptive-source-${randomUUID()}`,
      },
    }),
    prisma.user.create({
      data: {
        email: `adaptive-target-${randomUUID()}@example.com`,
        shortname: `adaptive-target-${randomUUID()}`,
      },
    }),
  ])
  const trees = await Promise.all(
    ['account-closure-tree-a', 'account-closure-tree-b'].map((name) =>
      prisma.competenceTree.create({
        data: {
          name,
          displayName: name,
          ownerId: source.id,
        },
      })
    )
  )

  return {
    sourceUserId: source.id,
    targetUserId: target.id,
    treeIds: trees.map(({ id }) => id),
  }
}
