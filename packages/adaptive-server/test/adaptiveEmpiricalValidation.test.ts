import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AdaptiveScaleDefinition } from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import type { AdaptiveEmpiricalValidationTaskInput } from '@klicker-uzh/types'
import { afterAll, beforeAll, beforeEach, vi } from 'vitest'
import {
  type AdaptiveValidationCalibration,
  adaptiveValidationCriterionSchema,
  adaptiveValidationGateFailures,
  createAdaptiveValidationAccumulator,
} from '../src/services/competenceTreeCalibrationValidationPolicy.js'
import {
  adaptiveValidationArtifactKey,
  adaptiveValidationEvidenceIdentity,
  handleAdaptiveEmpiricalValidation,
} from '../src/services/competenceTreeCalibrationValidationWorker.js'

const scale: AdaptiveScaleDefinition = {
  priorMean: 0,
  priorStandardDeviation: 1,
  gridMin: -6,
  gridMax: 6,
  gridStep: 0.1,
  classificationPolicyVersion: 1,
  levels: [
    {
      id: 1,
      label: 'Developing',
      order: 0,
      lowerBound: Number.NEGATIVE_INFINITY,
      upperBound: 0,
      itemDifficultyPrior: -1,
    },
    {
      id: 2,
      label: 'Established',
      order: 1,
      lowerBound: 0,
      upperBound: Number.POSITIVE_INFINITY,
      itemDifficultyPrior: 1,
    },
  ],
}

const receivedBatches: Array<{
  subjects: Array<{ localId: number; responses: unknown[] }>
}> = []
let fixtureMode: 'uniform' | 'mixed' | 'fail-second' = 'uniform'
beforeEach(() => {
  fixtureMode = 'uniform'
  receivedBatches.length = 0
})
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  expect(request.url).toBe('/adaptive/v1/posteriors')
  expect(request.headers.authorization).toBe(
    'Bearer synthetic-calibration-service-token-000000'
  )
  expect(raw).not.toContain('subjectPseudonym')
  expect(raw).not.toContain('cohort-a')
  expect(raw).not.toContain('Developing')
  expect(raw).not.toContain('levelOrder')
  const body = JSON.parse(raw)
  receivedBatches.push(body)
  if (fixtureMode === 'fail-second' && receivedBatches.length === 2) {
    response.writeHead(503).end()
    return
  }
  response.setHeader('content-type', 'application/json')
  response.end(
    JSON.stringify({
      contractVersion: 1,
      measurementVersion: 'IRT_V2_EAP_GRID_1',
      subjects: [...body.subjects]
        .reverse()
        .map((subject: { localId: number; responses: unknown[] }) => ({
          localId: subject.localId,
          responseCount: subject.responses.length,
          mean: 1,
          variance: 0.25,
          standardDeviation: 0.5,
          credibleLower: 0.3,
          credibleUpper: 1.7,
          bandProbabilities: [
            {
              levelId: 1,
              probability:
                fixtureMode === 'mixed' && subject.localId % 2 === 0
                  ? 0.9
                  : 0.01,
            },
            {
              levelId: 2,
              probability:
                fixtureMode === 'mixed' && subject.localId % 2 === 0
                  ? 0.1
                  : 0.99,
            },
          ],
        })),
    })
  )
})
beforeAll(async () => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing fixture port')
  vi.stubEnv('ADAPTIVE_ENGINE_URL', `http://127.0.0.1:${address.port}`)
  vi.stubEnv(
    'ADAPTIVE_ENGINE_TOKEN',
    'synthetic-calibration-service-token-000000'
  )
})
afterAll(async () => {
  vi.unstubAllEnvs()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('server-owned adaptive empirical validation', () => {
  it('binds retry lookup and retained artifacts to exact criterion evidence', () => {
    const input = validationTaskInput()
    const changedCriterion = {
      ...input,
      criterionArtifactChecksum: 'b'.repeat(64),
    }

    expect(adaptiveValidationEvidenceIdentity(input)).toMatchObject({
      exportRequestId: input.exportRequestId,
      validationProtocolVersion: input.validationProtocolVersion,
      criterionArtifactChecksum: input.criterionArtifactChecksum,
    })
    expect(adaptiveValidationArtifactKey(changedCriterion)).not.toBe(
      adaptiveValidationArtifactKey(input)
    )
  })

  it('fails before loading private artifacts without an approved protocol', async () => {
    const input = validationTaskInput()

    await expect(
      handleAdaptiveEmpiricalValidation(
        input,
        undefined as never,
        undefined as never
      )
    ).rejects.toThrow('ADAPTIVE_V2_VALIDATION_PROTOCOL_UNAVAILABLE')
  })

  it('aggregates validated service posteriors and derives passing confidence bounds', async () => {
    const calibrations = Array.from({ length: 100 }, (_, index) =>
      calibration(index + 1)
    )
    const criterion = adaptiveValidationCriterionSchema.parse({
      schemaVersion: 1,
      exportRequestId: '10000000-0000-4000-8000-000000000001',
      holdoutArtifactChecksum: 'a'.repeat(64),
      criterionVersion: 'independent-panel-v1',
      generatedAt: '2026-07-31T10:00:00.000Z',
      subjects: Array.from({ length: 100 }, (_, index) => ({
        subjectPseudonym: pseudonym(index),
        levelOrder: 1,
        strata: ['cohort-a'],
      })),
    })
    const accumulator = createAdaptiveValidationAccumulator({
      criterion,
      calibrations,
      expectedIdentity: {
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
        classificationPolicyVersion: 1,
        calibrationPolicyVersion: 1,
      },
    })

    for (let subjectIndex = 0; subjectIndex < 100; subjectIndex++) {
      for (let offset = 0; offset < 20; offset++) {
        const assignmentId = ((subjectIndex * 20 + offset) % 100) + 1
        accumulator.add(
          holdoutRow({
            subjectPseudonym: pseudonym(subjectIndex),
            calibration: calibrations[assignmentId - 1]!,
          })
        )
      }
    }

    const metrics = await accumulator.evaluate({
      scale,
      approvedProbabilityThreshold: 0.8,
      totalQuestionCap: 50,
    })
    expect(receivedBatches.map((batch) => batch.subjects.length)).toEqual([
      32, 32, 32, 4,
    ])
    expect(
      receivedBatches.flatMap((batch) =>
        batch.subjects.map((subject) => subject.localId)
      )
    ).toEqual(Array.from({ length: 100 }, (_, index) => index))
    expect(metrics.aggregateMetrics.exactAgreement).toBe(1)
    expect(
      metrics.aggregateMetrics.adjacentAgreementInterval.lower
    ).toBeGreaterThan(0.95)
    expect(metrics.aggregateMetrics.maximumExposure).toBe(0.2)
    expect(metrics.stratumMetrics).toHaveLength(1)
    expect(adaptiveValidationGateFailures(metrics)).toEqual([])
  })

  it('joins reordered mixed posteriors by local ID and retains stratum metrics', async () => {
    fixtureMode = 'mixed'
    const accumulator = populatedAccumulator(64)
    const metrics = await accumulator.evaluate({
      scale,
      approvedProbabilityThreshold: 0.8,
      totalQuestionCap: 50,
    })
    expect(metrics.aggregateMetrics.exactAgreement).toBe(0.5)
    expect(metrics.aggregateMetrics.adjacentAgreement).toBe(1)
    expect(metrics.aggregateMetrics.meanAbsoluteLevelError).toBe(0.5)
    expect(metrics.aggregateMetrics.calibrationError).toBeCloseTo(0.455)
    expect(metrics.aggregateMetrics.logLoss).toBeCloseTo(
      (-Math.log(0.1) - Math.log(0.99)) / 2
    )
    expect(
      metrics.stratumMetrics.find(({ key }) => key === 'even')?.metrics
        .exactAgreement
    ).toBe(0)
    expect(
      metrics.stratumMetrics.find(({ key }) => key === 'odd')?.metrics
        .exactAgreement
    ).toBe(1)
  })

  it('rejects the whole evaluation if a later posterior batch fails', async () => {
    fixtureMode = 'fail-second'
    await expect(
      populatedAccumulator(65).evaluate({
        scale,
        approvedProbabilityThreshold: 0.8,
        totalQuestionCap: 50,
      })
    ).rejects.toThrow('unavailable')
    expect(receivedBatches.map(({ subjects }) => subjects.length)).toEqual([
      32, 32,
    ])
  })

  it('rejects criterion artifacts containing raw identities or duplicates', () => {
    const subject = {
      subjectPseudonym: pseudonym(1),
      levelOrder: 1,
      strata: ['cohort-a'],
    }
    const base = {
      schemaVersion: 1,
      exportRequestId: '10000000-0000-4000-8000-000000000001',
      holdoutArtifactChecksum: 'a'.repeat(64),
      criterionVersion: 'independent-panel-v1',
      generatedAt: '2026-07-31T10:00:00.000Z',
      subjects: Array.from({ length: 30 }, (_, index) => ({
        ...subject,
        subjectPseudonym: pseudonym(index),
      })),
    }
    expect(
      adaptiveValidationCriterionSchema.safeParse({
        ...base,
        participantId: 'private',
      }).success
    ).toBe(false)
    expect(
      adaptiveValidationCriterionSchema.safeParse({
        ...base,
        subjects: [...base.subjects.slice(0, 29), base.subjects[0]],
      }).success
    ).toBe(false)
  })

  it('does not use field-test or provisional rows as scoring evidence', async () => {
    const criterion = adaptiveValidationCriterionSchema.parse({
      schemaVersion: 1,
      exportRequestId: '10000000-0000-4000-8000-000000000001',
      holdoutArtifactChecksum: 'a'.repeat(64),
      criterionVersion: 'independent-panel-v1',
      generatedAt: '2026-07-31T10:00:00.000Z',
      subjects: Array.from({ length: 30 }, (_, index) => ({
        subjectPseudonym: pseudonym(index),
        levelOrder: 1,
        strata: ['cohort-a'],
      })),
    })
    const record = calibration(1)
    const accumulator = createAdaptiveValidationAccumulator({
      criterion,
      calibrations: [record],
      expectedIdentity: {
        measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
        estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
        classificationPolicyVersion: 1,
        calibrationPolicyVersion: 1,
      },
    })
    accumulator.add({
      ...holdoutRow({ subjectPseudonym: pseudonym(0), calibration: record }),
      itemRole: DB.AdaptivePoolItemRole.FIELD_TEST,
    })
    await expect(
      accumulator.evaluate({
        scale,
        approvedProbabilityThreshold: 0.8,
        totalQuestionCap: 50,
      })
    ).rejects.toThrow('ADAPTIVE_VALIDATION_CRITERION_SUBJECT_MISSING')
  })
})

function validationTaskInput(): AdaptiveEmpiricalValidationTaskInput {
  return {
    exportRequestId: '10000000-0000-4000-8000-000000000001',
    configId: '10000000-0000-4000-8000-000000000002',
    treeId: '10000000-0000-4000-8000-000000000003',
    scaleVersionId: '10000000-0000-4000-8000-000000000004',
    criterionArtifactKey: 'criteria/tree/request/criterion.json',
    criterionArtifactChecksum: 'a'.repeat(64),
    submittedById: '10000000-0000-4000-8000-000000000005',
    bankFingerprint: 'bank-fingerprint',
    configFingerprint: 'config-fingerprint',
    measurementVersion: 'IRT_V2_EAP_GRID_1',
    estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
    classificationPolicyVersion: 1,
    calibrationPolicyVersion: 1,
    validationProtocolVersion: 'diagnostic-protocol-v1',
    approvedProbabilityThreshold: 0.8,
  }
}

function calibration(assignmentId: number): AdaptiveValidationCalibration {
  return {
    id: `10000000-0000-4000-8000-${String(assignmentId).padStart(12, '0')}`,
    assignmentId,
    elementId: assignmentId,
    elementVersion: 1,
    version: 1,
    model: DB.AdaptiveItemModel.THREE_PL_FIXED_C,
    status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
    discrimination: 2,
    difficulty: 0.5,
    guessing: 0.25,
  }
}

function holdoutRow({
  subjectPseudonym,
  calibration,
}: {
  subjectPseudonym: string
  calibration: AdaptiveValidationCalibration
}) {
  return {
    schemaVersion: 1,
    subjectPseudonym,
    cohortPseudonym: 'f'.repeat(64),
    publicationVersion: 1,
    measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
    estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
    classificationPolicyVersion: 1,
    calibrationPolicyVersion: 1,
    assignmentId: calibration.assignmentId,
    elementId: calibration.elementId,
    elementVersion: calibration.elementVersion,
    elementType: DB.ElementType.SC,
    calibrationId: calibration.id,
    calibrationVersion: calibration.version,
    calibrationStatus: calibration.status,
    itemModel: calibration.model,
    itemRole: DB.AdaptivePoolItemRole.ANCHOR,
    score: 1,
    correct: true,
    responseCategory: [0],
    elapsedSeconds: 30,
    administrationProbability: 0.5,
    collectionDesignVersion: 'IRT_V2_RESEARCH_COLLECTION_1',
    isCalibrationAnchor: true,
  }
}

function pseudonym(index: number) {
  return index.toString(16).padStart(64, '0')
}

function populatedAccumulator(count: number) {
  const record = calibration(1)
  const criterion = adaptiveValidationCriterionSchema.parse({
    schemaVersion: 1,
    exportRequestId: '10000000-0000-4000-8000-000000000001',
    holdoutArtifactChecksum: 'a'.repeat(64),
    criterionVersion: 'independent-panel-v1',
    generatedAt: '2026-07-31T10:00:00.000Z',
    subjects: Array.from({ length: count }, (_, index) => ({
      subjectPseudonym: pseudonym(index),
      levelOrder: 1,
      strata: [index % 2 === 0 ? 'even' : 'odd'],
    })),
  })
  const accumulator = createAdaptiveValidationAccumulator({
    criterion,
    calibrations: [record],
    expectedIdentity: {
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
      estimatorImplementationVersion: 'IRT_V2_EAP_GRID_1',
      classificationPolicyVersion: 1,
      calibrationPolicyVersion: 1,
    },
  })
  for (let index = 0; index < count; index++) {
    accumulator.add(
      holdoutRow({ subjectPseudonym: pseudonym(index), calibration: record })
    )
  }
  return accumulator
}
