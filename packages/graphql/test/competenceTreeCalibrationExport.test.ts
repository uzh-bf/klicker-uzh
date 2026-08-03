import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlerGlobalContext } from '@klicker-uzh/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  assignAdaptiveExportSplit,
  deriveAdaptiveExportPseudonym,
  projectAdaptiveCalibrationExportRow,
  type AdaptiveCalibrationExportSourceRow,
} from '../src/services/competenceTreeCalibrationExportProjection.js'
import {
  getAdaptiveCalibrationExportRequest,
  hasCurrentAdaptiveCalibrationExportAuthority,
  requestAdaptiveCalibrationExport,
  type AdaptiveCalibrationExportAuthorizationScope,
} from '../src/services/competenceTreeCalibrationExportRequest.js'
import {
  createAdaptiveExportOwnerDownloadUrl,
  getAdaptiveExportContainer,
} from '../src/services/competenceTreeCalibrationExportStorage.js'
import {
  claimAdaptiveCalibrationExportRun,
  exportArtifactKeys,
  failAdaptiveCalibrationExportRun,
  handleAdaptiveCalibrationExport,
  handleAdaptiveCalibrationExportCleanup,
  selectFirstExposureRows,
} from '../src/services/competenceTreeCalibrationExportWorker.js'

vi.mock('../src/services/competenceTreeCalibrationExportStorage.js', () => ({
  createAdaptiveExportOwnerDownloadUrl: vi.fn(() => 'signed-download-url'),
  getAdaptiveExportContainer: vi.fn(),
  getPositiveIntegerEnvironment: vi.fn(
    (_name: string, fallback: number) => fallback
  ),
  requiredEnvironment: vi.fn(() => 'unit-test-pseudonym-key'),
}))

const treeId = '10000000-0000-4000-8000-000000000001'
const scaleVersionId = '10000000-0000-4000-8000-000000000002'
const requestId = '10000000-0000-4000-8000-000000000003'
const ownerId = '10000000-0000-4000-8000-000000000004'
const requesterId = '10000000-0000-4000-8000-000000000005'
const adminId = '10000000-0000-4000-8000-000000000006'
const datasetVersion = 'dataset-2026-07-v1'
const hmacKey = 'unit-test-key-with-enough-entropy'

beforeEach(() => {
  vi.clearAllMocks()
})

function sourceRow(
  overrides: Partial<AdaptiveCalibrationExportSourceRow> = {}
): AdaptiveCalibrationExportSourceRow {
  return {
    responseId: 1,
    subjectKey: 'database-projected-subject-key',
    cohortKey: 'database-projected-cohort-key',
    publicationVersion: 2,
    measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
    estimatorImplementationVersion: 'eap-grid-v1',
    classificationPolicyVersion: 1,
    calibrationPolicyVersion: 1,
    assignmentId: 17,
    elementId: 23,
    elementVersion: 4,
    elementType: DB.ElementType.SC,
    calibrationId: '40000000-0000-4000-8000-000000000001',
    calibrationVersion: 3,
    calibrationStatus: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
    itemModel: DB.AdaptiveItemModel.THREE_PL_FIXED_C,
    itemRole: DB.AdaptivePoolItemRole.ANCHOR,
    score: 1,
    correct: true,
    responseCategory: [2],
    elapsedSeconds: 12,
    administrationProbability: 0.4,
    collectionDesignVersion: 'research-randomization-v1',
    isCalibrationAnchor: true,
    ...overrides,
  }
}

describe('adaptive calibration export pseudonyms', () => {
  it('is stable within a dataset and rotates across scopes and domains', () => {
    const input = {
      hmacKey,
      domain: 'subject' as const,
      treeId,
      datasetVersion,
      sourceId: 'participant-1',
    }
    const pseudonym = deriveAdaptiveExportPseudonym(input)

    expect(deriveAdaptiveExportPseudonym(input)).toBe(pseudonym)
    expect(
      deriveAdaptiveExportPseudonym({
        ...input,
        datasetVersion: 'dataset-2026-08-v1',
      })
    ).not.toBe(pseudonym)
    expect(
      deriveAdaptiveExportPseudonym({ ...input, treeId: crypto.randomUUID() })
    ).not.toBe(pseudonym)
    expect(
      deriveAdaptiveExportPseudonym({ ...input, domain: 'cohort' })
    ).not.toBe(pseudonym)
  })

  it('assigns a subject to one deterministic split before outcomes are read', () => {
    const input = {
      hmacKey,
      treeId,
      datasetVersion,
      subjectKey: 'database-projected-subject-key',
    }
    expect(assignAdaptiveExportSplit(input)).toBe(
      assignAdaptiveExportSplit(input)
    )
  })
})

function enqueueFailureContext({
  failedTransitionCount,
  currentRequest = null,
}: {
  failedTransitionCount: number
  currentRequest?: AdaptiveCalibrationExportAuthorizationScope | null
}) {
  const createdRequest = exportRequest({
    status: DB.AdaptiveCalibrationExportStatus.REQUESTED,
  })
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce([{ id: treeId, ownerId, isDeleted: false }])
    .mockResolvedValueOnce([
      {
        id: scaleVersionId,
        treeId,
        version: 1,
        status: DB.AdaptiveScaleVersionStatus.APPROVED,
        supersedesVersionId: null,
        createdById: ownerId,
      },
    ])
  const updateMany = vi.fn().mockResolvedValue({ count: failedTransitionCount })
  const findUnique = vi.fn().mockResolvedValue(currentRequest)
  const tx = {
    $queryRaw: queryRaw,
    adaptiveCalibrationExportRequest: {
      create: vi.fn().mockResolvedValue(createdRequest),
    },
  }
  const ctx = {
    user: {
      sub: ownerId,
      role: DB.UserRole.USER,
      scope: DB.UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      $transaction: vi.fn((operation) => operation(tx)),
      adaptiveCalibrationExportRequest: { updateMany, findUnique },
    },
    tasks: {
      adaptiveCalibrationExport: {
        runNoWait: vi.fn().mockRejectedValue(new Error('queue unavailable')),
      },
    },
  } as unknown as ContextWithUser
  return { ctx, updateMany, findUnique }
}

describe('adaptive calibration export requests', () => {
  it('transitions to a terminal failed state when enqueueing fails', async () => {
    const { ctx, updateMany } = enqueueFailureContext({
      failedTransitionCount: 1,
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      requestAdaptiveCalibrationExport(
        { treeId, scaleVersionId, datasetVersion },
        ctx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_EXPORT_ENQUEUE_FAILED' },
    })
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: requestId,
        status: DB.AdaptiveCalibrationExportStatus.REQUESTED,
      },
      data: {
        status: DB.AdaptiveCalibrationExportStatus.FAILED,
        failureCode: 'EXPORT_ENQUEUE_FAILED',
        completedAt: expect.any(Date),
        runToken: null,
      },
    })
    warnSpy.mockRestore()
  })

  it('returns the authoritative state when the worker won an enqueue race', async () => {
    const runningRequest = exportRequest({
      status: DB.AdaptiveCalibrationExportStatus.RUNNING,
    })
    const { ctx, findUnique } = enqueueFailureContext({
      failedTransitionCount: 0,
      currentRequest: runningRequest,
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      requestAdaptiveCalibrationExport(
        { treeId, scaleVersionId, datasetVersion },
        ctx
      )
    ).resolves.toMatchObject({
      id: requestId,
      status: DB.AdaptiveCalibrationExportStatus.RUNNING,
    })
    expect(findUnique).toHaveBeenCalledWith({ where: { id: requestId } })
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('adaptive calibration export projection', () => {
  it('keeps only choice category codes and strips source identities', () => {
    const projected = projectAdaptiveCalibrationExportRow({
      row: sourceRow(),
      treeId,
      datasetVersion,
      hmacKey,
    })

    expect(projected.responseCategory).toEqual([2])
    expect(projected.subjectPseudonym).toMatch(/^[a-f0-9]{64}$/)
    expect(projected.cohortPseudonym).toMatch(/^[a-f0-9]{64}$/)
    expect(projected).not.toHaveProperty('subjectKey')
    expect(projected).not.toHaveProperty('cohortKey')
    expect(projected).not.toHaveProperty('responseId')
    expect(projected).not.toHaveProperty('normalizedResponse')
  })

  it.each([
    DB.ElementType.NUMERICAL,
    DB.ElementType.FREE_TEXT,
  ])('retains scored evidence without entered values for %s', (elementType) => {
    const projected = projectAdaptiveCalibrationExportRow({
      row: sourceRow({ elementType, responseCategory: null }),
      treeId,
      datasetVersion,
      hmacKey,
    })

    expect(projected.responseCategory).toBeNull()
    expect(projected.score).toBe(1)
    expect(projected.correct).toBe(true)
  })

  it('rejects a raw response value that reaches the projection boundary', () => {
    expect(() =>
      projectAdaptiveCalibrationExportRow({
        row: sourceRow({
          elementType: DB.ElementType.FREE_TEXT,
          responseCategory: { value: 'private learner text' },
        }),
        treeId,
        datasetVersion,
        hmacKey,
      })
    ).toThrow('ADAPTIVE_EXPORT_INVALID_RESPONSE_CATEGORY')
  })

  it('caps elapsed time and rejects invalid inclusion probabilities', () => {
    expect(
      projectAdaptiveCalibrationExportRow({
        row: sourceRow({ elapsedSeconds: 100_000 }),
        treeId,
        datasetVersion,
        hmacKey,
      }).elapsedSeconds
    ).toBe(3_600)
    expect(() =>
      projectAdaptiveCalibrationExportRow({
        row: sourceRow({ administrationProbability: 0 }),
        treeId,
        datasetVersion,
        hmacKey,
      })
    ).toThrow('ADAPTIVE_EXPORT_INVALID_SOURCE_ROW')
  })

  it('projects opaque identity keys and allow-listed response categories in SQL', async () => {
    const queryRaw = vi.fn().mockResolvedValue([])
    const prisma = { $queryRaw: queryRaw } as unknown as DB.PrismaClient

    for await (const _row of selectFirstExposureRows(exportRequest(), prisma)) {
      // The empty query result intentionally exercises one SQL page only.
    }

    const sql = (queryRaw.mock.calls[0]![0] as readonly string[]).join('?')
    const selectClause = sql.slice(
      0,
      sql.indexOf('FROM "AdaptivePracticeQuizResponse"')
    )
    expect(selectClause).toContain('AS "subjectKey"')
    expect(selectClause).toContain('AS "cohortKey"')
    expect(selectClause).toContain(
      'response."normalizedResponse" -> \'choiceIndices\''
    )
    expect(selectClause).toContain('ELSE NULL')
    expect(selectClause.match(/attempt\."participantId"/g)).toHaveLength(1)
    expect(selectClause.match(/attempt\."courseId"/g)).toHaveLength(1)
    expect(selectClause.match(/response\."normalizedResponse"/g)).toHaveLength(
      1
    )
    expect(selectClause).not.toContain('attempt."participantId" AS')
    expect(selectClause).not.toContain('attempt."participantId",')
    expect(selectClause).not.toContain('attempt."courseId" AS')
    expect(selectClause).not.toContain('attempt."courseId",')
    expect(selectClause).not.toContain('response."normalizedResponse" AS')
    expect(selectClause).not.toContain('response."normalizedResponse",')
  })
})

describe('adaptive calibration export authorization', () => {
  it('accepts the current tree owner or a persisted administrator only', () => {
    const request = exportRequest({ ownerId })

    expect(
      hasCurrentAdaptiveCalibrationExportAuthority({
        request,
        actorId: ownerId,
        persistedRole: null,
      })
    ).toBe(true)
    expect(
      hasCurrentAdaptiveCalibrationExportAuthority({
        request,
        actorId: adminId,
        persistedRole: DB.UserRole.ADMIN,
      })
    ).toBe(true)
    expect(
      hasCurrentAdaptiveCalibrationExportAuthority({
        request,
        actorId: adminId,
        persistedRole: DB.UserRole.USER,
      })
    ).toBe(false)
  })

  it('rejects deleted or mismatched persisted tree and scale identities', () => {
    const request = exportRequest({ ownerId })

    for (const invalid of [
      { ...request, tree: { ...request.tree, isDeleted: true } },
      {
        ...request,
        tree: { ...request.tree, id: crypto.randomUUID() },
      },
      {
        ...request,
        scaleVersion: {
          ...request.scaleVersion,
          treeId: crypto.randomUUID(),
        },
      },
    ]) {
      expect(
        hasCurrentAdaptiveCalibrationExportAuthority({
          request: invalid,
          actorId: ownerId,
          persistedRole: null,
        })
      ).toBe(false)
    }
  })

  it('returns status and a download URL to the current full-access owner', async () => {
    const fixture = statusContext({ userId: ownerId, ownerId })

    await expect(
      getAdaptiveCalibrationExportRequest({ requestId }, fixture.ctx)
    ).resolves.toMatchObject({
      id: requestId,
      downloadUrl: 'signed-download-url',
    })
    expect(fixture.userFindUnique).not.toHaveBeenCalled()
    expect(createAdaptiveExportOwnerDownloadUrl).toHaveBeenCalledTimes(1)
  })

  it('rejects status and download access after tree ownership changes', async () => {
    const fixture = statusContext({
      userId: ownerId,
      ownerId: crypto.randomUUID(),
    })

    await expect(
      getAdaptiveCalibrationExportRequest({ requestId }, fixture.ctx)
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
    expect(createAdaptiveExportOwnerDownloadUrl).not.toHaveBeenCalled()
  })

  it('does not trust a stale administrator claim for status or download', async () => {
    const fixture = statusContext({
      userId: adminId,
      ownerId,
      role: DB.UserRole.ADMIN,
      persistedRole: DB.UserRole.USER,
    })

    await expect(
      getAdaptiveCalibrationExportRequest({ requestId }, fixture.ctx)
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
    expect(fixture.userFindUnique).toHaveBeenCalledWith({
      where: { id: adminId },
      select: { role: true },
    })
    expect(createAdaptiveExportOwnerDownloadUrl).not.toHaveBeenCalled()
  })

  it('allows a currently persisted full-access administrator', async () => {
    const fixture = statusContext({
      userId: adminId,
      ownerId,
      role: DB.UserRole.ADMIN,
      persistedRole: DB.UserRole.ADMIN,
    })

    await expect(
      getAdaptiveCalibrationExportRequest({ requestId }, fixture.ctx)
    ).resolves.toMatchObject({
      id: requestId,
      downloadUrl: 'signed-download-url',
    })
  })

  it('rejects read-only status access before loading export metadata', async () => {
    const fixture = statusContext({
      userId: ownerId,
      ownerId,
      scope: DB.UserLoginScope.READ_ONLY,
    })

    await expect(
      getAdaptiveCalibrationExportRequest({ requestId }, fixture.ctx)
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    expect(fixture.requestFindUnique).not.toHaveBeenCalled()
    expect(createAdaptiveExportOwnerDownloadUrl).not.toHaveBeenCalled()
  })

  it('fails an unauthorized worker request before claiming or reading data', async () => {
    const requestFindUnique = vi
      .fn()
      .mockResolvedValue(workerExportRequest({ ownerId }))
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = {
      prisma: {
        adaptiveCalibrationExportRequest: {
          findUnique: requestFindUnique,
          updateMany,
        },
      },
    } as unknown as HatchetHandlerGlobalContext

    try {
      await expect(
        handleAdaptiveCalibrationExport(
          { exportRequestId: requestId },
          ctx,
          {} as never
        )
      ).resolves.toBe(true)
    } finally {
      warn.mockRestore()
    }

    expect(requestFindUnique).toHaveBeenCalledTimes(1)
    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DB.AdaptiveCalibrationExportStatus.FAILED,
          failureCode: 'ADAPTIVE_EXPORT_AUTHORIZATION_REVOKED',
        }),
      })
    )
    expect(getAdaptiveExportContainer).not.toHaveBeenCalled()
  })

  it('fails a claimed worker request if requester ownership is revoked', async () => {
    const authorized = workerExportRequest({ ownerId: requesterId })
    const revoked = workerExportRequest({ ownerId })
    const requestFindUnique = vi
      .fn()
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(revoked)
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctx = {
      prisma: {
        adaptiveCalibrationExportRequest: {
          findUnique: requestFindUnique,
          updateMany,
        },
      },
    } as unknown as HatchetHandlerGlobalContext

    try {
      await expect(
        handleAdaptiveCalibrationExport(
          { exportRequestId: requestId },
          ctx,
          {} as never
        )
      ).resolves.toBe(true)
    } finally {
      warn.mockRestore()
    }

    expect(requestFindUnique).toHaveBeenCalledTimes(2)
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: requestId }),
        data: expect.objectContaining({
          status: DB.AdaptiveCalibrationExportStatus.FAILED,
          failureCode: 'ADAPTIVE_EXPORT_AUTHORIZATION_REVOKED',
        }),
      })
    )
    expect(getAdaptiveExportContainer).not.toHaveBeenCalled()
  })

  it('expires and deletes artifacts for an abandoned running request', async () => {
    const request = {
      ...exportRequest({ status: DB.AdaptiveCalibrationExportStatus.RUNNING }),
      runToken: '20000000-0000-4000-8000-000000000003',
      criterionArtifactKey: `${treeId}/${requestId}/criterion.json`,
      criterionArtifactChecksum: 'a'.repeat(64),
      expiresAt: new Date('2026-07-31T11:00:00.000Z'),
    }
    const deleteIfExists = vi.fn().mockResolvedValue(undefined)
    const getBlobClient = vi.fn(() => ({ deleteIfExists }))
    vi.mocked(getAdaptiveExportContainer).mockResolvedValue({
      getBlobClient,
    } as never)
    const findMany = vi.fn().mockResolvedValue([request])
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const ctx = {
      prisma: {
        adaptiveCalibrationExportRequest: { findMany, updateMany },
      },
    } as unknown as HatchetHandlerGlobalContext

    await expect(
      handleAdaptiveCalibrationExportCleanup({}, ctx, {} as never)
    ).resolves.toBe(true)

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({
            in: expect.arrayContaining([
              DB.AdaptiveCalibrationExportStatus.RUNNING,
            ]),
          }),
        }),
      })
    )
    expect(getBlobClient).toHaveBeenCalledTimes(7)
    expect(deleteIfExists).toHaveBeenCalledTimes(7)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: requestId }),
        data: expect.objectContaining({
          status: DB.AdaptiveCalibrationExportStatus.EXPIRED,
          runToken: null,
        }),
      })
    )
  })
})

describe('adaptive calibration export worker leases', () => {
  it('fences a stale worker after another run reclaims the request', async () => {
    const firstRunToken = '20000000-0000-4000-8000-000000000001'
    const secondRunToken = '20000000-0000-4000-8000-000000000002'
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    const prisma = {
      adaptiveCalibrationExportRequest: { updateMany },
    } as unknown as DB.PrismaClient

    await expect(
      claimAdaptiveCalibrationExportRun({
        requestId,
        prisma,
        startedAt: new Date('2026-08-01T10:00:00.000Z'),
        runToken: firstRunToken,
      })
    ).resolves.toBe(firstRunToken)
    await expect(
      claimAdaptiveCalibrationExportRun({
        requestId,
        prisma,
        startedAt: new Date('2026-08-01T10:31:00.000Z'),
        runToken: secondRunToken,
      })
    ).resolves.toBe(secondRunToken)

    await expect(
      failAdaptiveCalibrationExportRun({
        requestId,
        runToken: firstRunToken,
        failureCode: 'ADAPTIVE_EXPORT_PROCESSING_FAILED',
        prisma,
      })
    ).resolves.toEqual({ count: 0 })
    await expect(
      failAdaptiveCalibrationExportRun({
        requestId,
        runToken: secondRunToken,
        failureCode: 'ADAPTIVE_EXPORT_PROCESSING_FAILED',
        prisma,
      })
    ).resolves.toEqual({ count: 1 })

    expect(updateMany.mock.calls[2]![0]).toMatchObject({
      where: {
        id: requestId,
        status: DB.AdaptiveCalibrationExportStatus.RUNNING,
        runToken: firstRunToken,
      },
    })
    expect(updateMany.mock.calls[3]![0]).toMatchObject({
      where: {
        id: requestId,
        status: DB.AdaptiveCalibrationExportStatus.RUNNING,
        runToken: secondRunToken,
      },
    })
    expect(exportArtifactKeys(treeId, requestId, firstRunToken)).not.toEqual(
      exportArtifactKeys(treeId, requestId, secondRunToken)
    )
  })
})

function exportRequest({
  ownerId: currentOwnerId = ownerId,
  status = DB.AdaptiveCalibrationExportStatus.READY,
}: {
  ownerId?: string
  status?: DB.AdaptiveCalibrationExportStatus
} = {}): AdaptiveCalibrationExportAuthorizationScope {
  const createdAt = new Date('2026-07-31T12:00:00.000Z')
  return {
    id: requestId,
    status,
    runToken: null,
    datasetVersion,
    splitPolicyVersion: 'HMAC_80_20_V1',
    treeId,
    scaleVersionId,
    requestedById: requesterId,
    artifactKey: 'tree/request/calibration.ndjson.gz',
    artifactChecksum: 'calibration-checksum',
    rowCount: 10,
    manifestArtifactKey: 'tree/request/manifest.json',
    manifestChecksum: 'manifest-checksum',
    holdoutArtifactKey: 'tree/request/holdout.ndjson.gz',
    holdoutArtifactChecksum: 'holdout-checksum',
    holdoutRowCount: 2,
    criterionArtifactKey: null,
    criterionArtifactChecksum: null,
    failureCode: null,
    createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    expiresAt: new Date('2099-07-31T12:00:00.000Z'),
    updatedAt: createdAt,
    tree: { id: treeId, ownerId: currentOwnerId, isDeleted: false },
    scaleVersion: { id: scaleVersionId, treeId },
  }
}

function workerExportRequest({ ownerId: currentOwnerId }: { ownerId: string }) {
  return {
    ...exportRequest({
      ownerId: currentOwnerId,
      status: DB.AdaptiveCalibrationExportStatus.REQUESTED,
    }),
    requestedBy: { role: DB.UserRole.USER },
  }
}

function statusContext({
  userId,
  ownerId: currentOwnerId,
  role = DB.UserRole.USER,
  persistedRole = DB.UserRole.USER,
  scope = DB.UserLoginScope.FULL_ACCESS,
}: {
  userId: string
  ownerId: string
  role?: DB.UserRole
  persistedRole?: DB.UserRole
  scope?: DB.UserLoginScope
}) {
  const requestFindUnique = vi
    .fn()
    .mockResolvedValue(exportRequest({ ownerId: currentOwnerId }))
  const userFindUnique = vi.fn().mockResolvedValue({ role: persistedRole })
  const ctx = {
    user: {
      sub: userId,
      role,
      scope,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      adaptiveCalibrationExportRequest: { findUnique: requestFindUnique },
      user: { findUnique: userFindUnique },
    },
  } as unknown as ContextWithUser

  return { ctx, requestFindUnique, userFindUnique }
}
