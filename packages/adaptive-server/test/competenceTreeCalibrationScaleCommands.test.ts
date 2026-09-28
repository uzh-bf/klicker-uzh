import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { AdaptiveScaleLinkArtifact } from '../src/services/competenceTreeCalibrationArtifact.js'
import {
  assertScaleLinkAnchors,
  SCALE_LINK_CALIBRATION_BATCH_SIZE,
} from '../src/services/competenceTreeCalibrationScaleCommands.js'

const treeId = '30000000-0000-4000-8000-000000000001'
const fromScaleVersionId = '30000000-0000-4000-8000-000000000002'
const toScaleVersionId = '30000000-0000-4000-8000-000000000003'

function calibrationId(prefix: '4' | '5', index: number) {
  return `${prefix}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

describe('scale-link anchor validation', () => {
  it('loads calibrations in bounded batches and validates pairs in memory', async () => {
    const anchorCount = SCALE_LINK_CALIBRATION_BATCH_SIZE + 1
    const anchors = Array.from({ length: anchorCount }, (_, index) => ({
      fromCalibrationId: calibrationId('4', index),
      toCalibrationId: calibrationId('5', index),
    }))
    const calibrations = new Map(
      anchors.flatMap((anchor, index) => [
        [
          anchor.fromCalibrationId,
          {
            id: anchor.fromCalibrationId,
            treeId,
            scaleVersionId: fromScaleVersionId,
            assignmentId: index + 1,
            elementId: index + 10,
            elementVersion: 1,
            status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
          },
        ],
        [
          anchor.toCalibrationId,
          {
            id: anchor.toCalibrationId,
            treeId,
            scaleVersionId: toScaleVersionId,
            assignmentId: index + 1,
            elementId: index + 10,
            elementVersion: 1,
            status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
          },
        ],
      ])
    )
    const findMany = vi.fn(({ where }) =>
      Promise.resolve(
        where.id.in.map((id: string) => calibrations.get(id)!).filter(Boolean)
      )
    )
    const tx = {
      adaptiveItemCalibration: { findMany },
    } as unknown as DB.Prisma.TransactionClient
    const metric = {
      anchorCount,
      intercept: 0,
      slope: 1,
      rootMeanSquareError: 0,
      interceptStandardError: 0,
      slopeStandardError: 0,
    }
    const artifact: AdaptiveScaleLinkArtifact = {
      schemaVersion: 1,
      treeId,
      fromScaleVersionId,
      toScaleVersionId,
      method: 'FIXED_ANCHOR',
      implementationVersion: 'link-v1',
      generatedAt: '2026-08-01T10:00:00.000Z',
      anchors,
      fitMetrics: metric,
      uncertaintyMetrics: metric,
      artifactChecksum: 'a'.repeat(64),
      artifactKey: 'private/scale-link.json',
    }

    await expect(assertScaleLinkAnchors(tx, artifact)).resolves.toBeUndefined()
    expect(findMany).toHaveBeenCalledTimes(
      Math.ceil((anchorCount * 2) / SCALE_LINK_CALIBRATION_BATCH_SIZE)
    )
    for (const [args] of findMany.mock.calls) {
      expect(args.where.id.in.length).toBeLessThanOrEqual(
        SCALE_LINK_CALIBRATION_BATCH_SIZE
      )
    }
  })

  it('rejects distinct calibration pairs for the same logical item', async () => {
    const anchors = [
      {
        fromCalibrationId: calibrationId('4', 1),
        toCalibrationId: calibrationId('5', 1),
      },
      {
        fromCalibrationId: calibrationId('4', 2),
        toCalibrationId: calibrationId('5', 2),
      },
    ]
    const calibrations = new Map(
      anchors.flatMap((anchor) => [
        [
          anchor.fromCalibrationId,
          {
            id: anchor.fromCalibrationId,
            treeId,
            scaleVersionId: fromScaleVersionId,
            assignmentId: 17,
            elementId: 23,
            elementVersion: 4,
            status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
          },
        ],
        [
          anchor.toCalibrationId,
          {
            id: anchor.toCalibrationId,
            treeId,
            scaleVersionId: toScaleVersionId,
            assignmentId: 17,
            elementId: 23,
            elementVersion: 4,
            status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
          },
        ],
      ])
    )
    const tx = {
      adaptiveItemCalibration: {
        findMany: vi.fn(({ where }) =>
          Promise.resolve(
            where.id.in
              .map((id: string) => calibrations.get(id)!)
              .filter(Boolean)
          )
        ),
      },
    } as unknown as DB.Prisma.TransactionClient
    const metric = {
      anchorCount: anchors.length,
      intercept: 0,
      slope: 1,
      rootMeanSquareError: 0,
      interceptStandardError: 0,
      slopeStandardError: 0,
    }
    const artifact: AdaptiveScaleLinkArtifact = {
      schemaVersion: 1,
      treeId,
      fromScaleVersionId,
      toScaleVersionId,
      method: 'FIXED_ANCHOR',
      implementationVersion: 'link-v1',
      generatedAt: '2026-08-01T10:00:00.000Z',
      anchors,
      fitMetrics: metric,
      uncertaintyMetrics: metric,
      artifactChecksum: 'a'.repeat(64),
      artifactKey: 'private/scale-link.json',
    }

    await expect(assertScaleLinkAnchors(tx, artifact)).rejects.toMatchObject({
      extensions: {
        code: 'ADAPTIVE_SCALE_LINK_LOGICAL_ANCHOR_DUPLICATE',
      },
    })
  })
})
