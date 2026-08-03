import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { submitAdaptiveItemCalibrationCandidates } from '../src/services/competenceTreeCalibrationItemCommands.js'
import {
  calibrationServiceError,
  calibrationTransaction,
} from '../src/services/competenceTreeCalibrationRepository.js'
import { activateCompetenceTreeScaleVersion } from '../src/services/competenceTreeCalibrationScaleCommands.js'

const userId = '10000000-0000-4000-8000-000000000001'
const treeId = '10000000-0000-4000-8000-000000000002'
const scaleVersionId = '10000000-0000-4000-8000-000000000003'
const datasetChecksum = 'a'.repeat(64)

describe('adaptive calibration command safety', () => {
  it('fails closed when an import has no matching ready, unexpired export', async () => {
    const exportLookup = vi.fn().mockResolvedValue(null)
    const tx = {
      $queryRaw: calibrationLockQuery(),
      adaptiveCalibrationExportRequest: { findFirst: exportLookup },
    }
    const ctx = calibrationContext(tx)

    await expect(
      submitAdaptiveItemCalibrationCandidates(calibrationArtifact(), ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_CALIBRATION_DATASET_NOT_VERIFIED' },
    })

    expect(exportLookup).toHaveBeenCalledWith({
      where: {
        treeId,
        scaleVersionId,
        datasetVersion: 'dataset-v1',
        artifactChecksum: datasetChecksum,
        status: DB.AdaptiveCalibrationExportStatus.READY,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    })
  })

  it('locks the tree before the target scale during activation', async () => {
    const lockOrder: string[] = []
    const tx = {
      $queryRaw: calibrationLockQuery(lockOrder),
      competenceTreeScaleVersion: {
        findUnique: vi.fn().mockImplementation(async () => {
          lockOrder.push('discover-scale')
          return { treeId }
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ id: scaleVersionId, treeId }),
      },
    }
    const ctx = calibrationContext(tx)

    await activateCompetenceTreeScaleVersion({ scaleVersionId }, ctx)

    expect(lockOrder.slice(0, 3)).toEqual([
      'discover-scale',
      'lock-tree',
      'lock-scale',
    ])
  })

  it('retries serialization conflicts and keeps application errors intact', async () => {
    const tx = {}
    const operation = vi.fn().mockResolvedValue('done')
    const transaction = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(
        async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)
      )
    const ctx = calibrationContext(tx, transaction)

    await expect(calibrationTransaction(ctx, operation)).resolves.toBe('done')
    expect(transaction).toHaveBeenCalledTimes(2)

    const applicationError = calibrationServiceError(
      'The calibration is invalid.',
      'ADAPTIVE_CALIBRATION_INVALID'
    )
    const failingTransaction = vi.fn().mockRejectedValue(applicationError)

    await expect(
      calibrationTransaction(
        calibrationContext(tx, failingTransaction),
        operation
      )
    ).rejects.toBe(applicationError)
    expect(failingTransaction).toHaveBeenCalledTimes(1)
  })

  it('returns a stable GraphQL error after exhausting conflict retries', async () => {
    const transaction = vi.fn().mockRejectedValue({
      meta: {
        driverAdapterError: {
          cause: { kind: 'TransactionWriteConflict' },
        },
      },
    })

    await expect(
      calibrationTransaction(calibrationContext({}, transaction), vi.fn())
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_CALIBRATION_CONFLICT' },
    })
    expect(transaction).toHaveBeenCalledTimes(3)
  })
})

function calibrationArtifact() {
  return {
    schemaVersion: 1,
    treeId,
    scaleVersionId,
    datasetVersion: 'dataset-v1',
    datasetChecksum,
    calibrationJobId: 'job-v1',
    generatedAt: '2026-07-31T10:00:00.000Z',
    modelImplementationVersion: 'mml-1.0.0',
    diagnosticsPolicyVersion: 1,
    calibrations: [
      {
        assignmentId: 10,
        elementVersion: 2,
        model: 'THREE_PL_FIXED_C',
        discrimination: 1.2,
        difficulty: 0.5,
        guessing: 0.25,
        discriminationStandardError: 0.1,
        difficultyStandardError: 0.2,
        responseCount: 100,
        participantCount: 100,
        diagnostics: {
          policyVersion: 1,
          fitStatus: 'PASS',
          difStatus: 'PASS',
          driftStatus: 'PASS',
          fitStatistic: 0.03,
          difEffect: null,
          driftEffect: null,
          holdoutLogLoss: 0.42,
          codes: [],
        },
      },
    ],
  }
}

function calibrationLockQuery(lockOrder: string[] = []) {
  return vi.fn().mockImplementation(async (query: TemplateStringsArray) => {
    const sql = query.join(' ')
    if (sql.includes('FROM "CompetenceTree"')) {
      lockOrder.push('lock-tree')
      return [{ id: treeId, ownerId: userId, isDeleted: false }]
    }
    if (sql.includes('FROM "CompetenceTreeScaleVersion"')) {
      lockOrder.push('lock-scale')
      return [
        {
          id: scaleVersionId,
          treeId,
          version: 1,
          status: DB.AdaptiveScaleVersionStatus.APPROVED,
          supersedesVersionId: null,
          createdById: userId,
        },
      ]
    }
    throw new Error(`Unexpected lock query: ${sql}`)
  })
}

function calibrationContext(
  tx: object,
  transaction = vi.fn(async (operation: (value: object) => Promise<unknown>) =>
    operation(tx)
  )
) {
  return {
    user: {
      sub: userId,
      role: DB.UserRole.USER,
      scope: DB.UserLoginScope.FULL_ACCESS,
    },
    prisma: { $transaction: transaction },
  } as unknown as ContextWithUser
}
