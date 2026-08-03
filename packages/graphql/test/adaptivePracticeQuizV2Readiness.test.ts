import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { buildAdaptiveV2ConfigFingerprint } from '../src/services/adaptivePracticeQuizV2Fingerprint.js'
import { assessAdaptiveV2Readiness } from '../src/services/adaptivePracticeQuizV2Readiness.js'
import { resolveAdaptiveMeasurementSelection } from '../src/services/adaptivePracticeQuizV2Selection.js'

describe('adaptive IRT v2 selection and readiness', () => {
  it('keeps v1 as the default when no scale is selected', async () => {
    const selection = await resolveAdaptiveMeasurementSelection({
      courseId: 'course',
      input: {
        competenceTreeId: 'tree',
        preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
      },
      tree: tree() as never,
      userId: 'owner',
      prisma: {} as never,
    })

    expect(selection).toEqual({
      measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V1,
      scaleVersionId: null,
      calibrationPolicyVersion: null,
    })
  })

  it('rejects Placement and author-controlled v2 parameters', async () => {
    const prisma = selectionPrisma()
    await expect(
      resolveAdaptiveMeasurementSelection({
        courseId: 'course',
        input: {
          competenceTreeId: 'tree',
          scaleVersionId: 'scale',
          preset: DB.AdaptivePracticeQuizPreset.PLACEMENT,
        },
        tree: tree() as never,
        userId: 'owner',
        prisma: prisma as never,
      })
    ).rejects.toMatchObject({
      extensions: { code: 'ADAPTIVE_V2_PLACEMENT_UNAVAILABLE' },
    })
    await expect(
      resolveAdaptiveMeasurementSelection({
        courseId: 'course',
        input: {
          competenceTreeId: 'tree',
          scaleVersionId: 'scale',
          preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
          classificationZ: 1.96,
        },
        tree: tree() as never,
        userId: 'owner',
        prisma: prisma as never,
      })
    ).rejects.toMatchObject({
      extensions: {
        code: 'ADAPTIVE_V2_CLASSIFICATION_OVERRIDE_FORBIDDEN',
      },
    })
  })

  it('fails closed on missing, stale, and flagged exact calibrations', async () => {
    for (const [records, expectedCode] of [
      [[], 'ADAPTIVE_V2_CALIBRATION_MISSING'],
      [
        [calibration({ elementVersion: 1 })],
        'ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH',
      ],
      [
        [
          calibration({
            elementVersion: 2,
            status: DB.AdaptiveItemCalibrationStatus.FLAGGED,
          }),
        ],
        'ADAPTIVE_V2_CALIBRATION_FLAGGED',
      ],
    ] as const) {
      const assessment = await assessAdaptiveV2Readiness({
        configId: 'config',
        courseId: 'course',
        scaleVersionId: 'scale',
        preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        prepared: prepared([{ id: 1, elementVersion: 2 }]),
        prisma: readinessPrisma([...records]) as never,
      })
      expect(assessment.readiness.errors).toContainEqual(
        expect.objectContaining({ code: expectedCode })
      )
      expect(assessment.readiness.ready).toBe(false)
    }
  })

  it('accepts a connected Research bank without exposing a proficiency release', async () => {
    const assessment = await assessAdaptiveV2Readiness({
      configId: 'config',
      courseId: 'course',
      scaleVersionId: 'scale',
      preset: DB.AdaptivePracticeQuizPreset.RESEARCH,
      prepared: connectedResearchPrepared(),
      prisma: readinessPrisma(connectedResearchCalibrations()) as never,
    })

    expect(assessment.readiness.errors).toEqual([])
    expect(assessment.readiness.ready).toBe(true)
    expect(assessment.calibrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assignmentId: 1,
          role: DB.AdaptivePoolItemRole.ANCHOR,
          contributesToEstimate: true,
        }),
        expect.objectContaining({
          assignmentId: 8,
          role: DB.AdaptivePoolItemRole.FIELD_TEST,
          contributesToEstimate: false,
        }),
      ])
    )
  })

  it('keeps classification reachability advisory for non-classifying Research publication', async () => {
    const currentPrepared = connectedResearchPrepared() as unknown as {
      readiness: {
        ready: boolean
        warnings: Array<{
          code: string
          message: string
          parameters: Record<string, never>
        }>
      }
    }
    currentPrepared.readiness.ready = false
    currentPrepared.readiness.warnings = [
      {
        code: 'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
        message: 'Classification is intentionally not released in Research.',
        parameters: {},
      },
    ]

    const assessment = await assessAdaptiveV2Readiness({
      configId: 'config',
      courseId: 'course',
      scaleVersionId: 'scale',
      preset: DB.AdaptivePracticeQuizPreset.RESEARCH,
      prepared: currentPrepared as never,
      prisma: readinessPrisma(connectedResearchCalibrations()) as never,
    })

    expect(assessment.readiness.ready).toBe(true)
    expect(assessment.readiness.warnings).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE',
      })
    )
  })

  it('rejects Research banks with only two distinct items per mandatory role', async () => {
    const assessment = await assessAdaptiveV2Readiness({
      configId: 'config',
      courseId: 'course',
      scaleVersionId: 'scale',
      preset: DB.AdaptivePracticeQuizPreset.RESEARCH,
      prepared: underProvisionedResearchPrepared(),
      prisma: readinessPrisma(underProvisionedResearchCalibrations()) as never,
    })

    expect(assessment.readiness.ready).toBe(false)
    expect(
      assessment.readiness.errors.filter(
        ({ code }) => code === 'ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED'
      )
    ).toHaveLength(2)
    expect(assessment.readiness.errors).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_RESEARCH_FIELD_TEST_COVERAGE_INVALID',
        leafNodeId: 31,
      })
    )
  })

  it('refuses approved evidence while no validation protocol is released', async () => {
    const records = [calibration({ elementVersion: 2 })]
    const config = adaptiveConfig()
    const currentPrepared = prepared([{ id: 1, elementVersion: 2 }])
    const baseline = await assessAdaptiveV2Readiness({
      configId: 'config',
      courseId: 'course',
      scaleVersionId: 'scale',
      preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
      prepared: currentPrepared,
      prisma: readinessPrisma(records, { config }) as never,
    })
    const configFingerprint = buildAdaptiveV2ConfigFingerprint({
      config,
      prepared: currentPrepared,
      scale: baseline.scale,
      bankFingerprint: baseline.bankFingerprint,
    })

    const assessment = await assessAdaptiveV2Readiness({
      configId: 'config',
      courseId: 'course',
      scaleVersionId: 'scale',
      preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
      prepared: currentPrepared,
      prisma: readinessPrisma(records, {
        config,
        validations: [
          {
            id: 'validation',
            status: DB.AdaptiveEmpiricalValidationStatus.APPROVED,
            bankFingerprint: baseline.bankFingerprint,
            configFingerprint,
          },
        ],
      }) as never,
    })

    expect(assessment.empiricalValidationId).toBeNull()
    expect(assessment.readiness.errors).toContainEqual(
      expect.objectContaining({
        code: 'ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED',
      })
    )
  })

  it.each([
    [
      'node weights',
      adaptiveConfig(),
      prepared([{ id: 1, elementVersion: 2 }], { nodeWeight: 2 }),
    ],
    [
      'question caps',
      adaptiveConfig({ totalQuestionCap: 13 }),
      prepared([{ id: 1, elementVersion: 2 }]),
    ],
  ])(
    'changes the validation fingerprint after changing %s',
    async (_, currentConfig, currentPrepared) => {
      const records = [calibration({ elementVersion: 2 })]
      const baselineConfig = adaptiveConfig()
      const baselinePrepared = prepared([{ id: 1, elementVersion: 2 }])
      const baseline = await assessAdaptiveV2Readiness({
        configId: 'config',
        courseId: 'course',
        scaleVersionId: 'scale',
        preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        prepared: baselinePrepared,
        prisma: readinessPrisma(records, { config: baselineConfig }) as never,
      })
      const configFingerprint = buildAdaptiveV2ConfigFingerprint({
        config: baselineConfig,
        prepared: baselinePrepared,
        scale: baseline.scale,
        bankFingerprint: baseline.bankFingerprint,
      })

      const currentFingerprint = buildAdaptiveV2ConfigFingerprint({
        config: currentConfig,
        prepared: currentPrepared,
        scale: baseline.scale,
        bankFingerprint: baseline.bankFingerprint,
      })

      expect(currentFingerprint).not.toBe(configFingerprint)
    }
  )
})

function selectionPrisma() {
  return {
    competenceTreeScaleVersion: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'scale',
        status: DB.AdaptiveScaleVersionStatus.ACTIVE,
        classificationPolicyVersion: 1,
        _count: { levels: 2 },
      }),
    },
    course: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ isAdaptiveLearningCalibrationEnabled: true }),
    },
  }
}

function readinessPrisma(
  records: DB.AdaptiveItemCalibration[],
  {
    config = adaptiveConfig(),
    validations = [],
  }: {
    config?: ReturnType<typeof adaptiveConfig>
    validations?: Array<{
      id: string
      status: DB.AdaptiveEmpiricalValidationStatus
      bankFingerprint: string
      configFingerprint: string
    }>
  } = {}
) {
  return {
    competenceTreeScaleVersion: {
      findUnique: vi.fn().mockResolvedValue(scale()),
    },
    adaptiveItemCalibration: {
      findMany: vi.fn().mockResolvedValue(records),
    },
    adaptivePracticeQuizEmpiricalValidation: {
      findMany: vi.fn().mockResolvedValue(validations),
    },
    practiceQuizAdaptiveConfig: {
      findUnique: vi.fn().mockResolvedValue(config),
    },
    course: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ isAdaptiveLearningCalibrationEnabled: true }),
    },
  }
}

function tree() {
  return { id: 'tree', ownerId: 'owner' }
}

function scale() {
  return {
    id: 'scale',
    treeId: 'tree',
    version: 1,
    status: DB.AdaptiveScaleVersionStatus.ACTIVE,
    priorMean: 0,
    priorStandardDeviation: 1,
    gridMin: -6,
    gridMax: 6,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    supersedesVersionId: null,
    createdById: 'owner',
    submittedForReviewAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    levels: [
      {
        id: 11,
        treeId: 'tree',
        scaleVersionId: 'scale',
        sourceLevelId: 21,
        order: 0,
        label: 'Foundation',
        lowerBound: null,
        itemDifficultyPrior: -1,
      },
      {
        id: 12,
        treeId: 'tree',
        scaleVersionId: 'scale',
        sourceLevelId: 22,
        order: 1,
        label: 'Advanced',
        lowerBound: 0,
        itemDifficultyPrior: 1,
      },
    ],
  }
}

function adaptiveConfig(
  overrides: Partial<DB.PracticeQuizAdaptiveConfig> = {}
) {
  return {
    id: 'config',
    competenceTreeId: 'tree',
    scaleVersionId: 'scale',
    measurementVersion: DB.AdaptiveMeasurementVersion.IRT_V2_EAP_GRID_1,
    calibrationPolicyVersion: 1,
    preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
    attemptSelectionPolicy: DB.AdaptiveAttemptSelectionPolicy.LATEST_COMPLETED,
    totalQuestionCap: 12,
    perLeafQuestionCap: 4,
    minQuestionsPerLeaf: 1,
    ...overrides,
  }
}

function calibration(
  overrides: Partial<DB.AdaptiveItemCalibration> = {}
): DB.AdaptiveItemCalibration {
  return {
    id: `calibration-${overrides.assignmentId ?? 1}`,
    treeId: 'tree',
    scaleVersionId: 'scale',
    assignmentId: 1,
    elementId: 101,
    elementVersion: 2,
    version: 1,
    model: DB.AdaptiveItemModel.TWO_PL,
    status: DB.AdaptiveItemCalibrationStatus.CALIBRATED,
    discrimination: 1.2,
    difficulty: 0,
    guessing: 0,
    parameterUncertainty: {
      discriminationStandardError: 0.05,
      difficultyStandardError: 0.1,
      guessingStandardError: null,
      discriminationInterval: [1.1, 1.3],
      difficultyInterval: [-0.2, 0.2],
      guessingInterval: null,
    },
    responseCount: 500,
    participantCount: 100,
    diagnostics: {
      fitStatus: 'PASS',
      difStatus: 'PASS',
      driftStatus: 'PASS',
      fitStatistics: {},
      warningCodes: [],
      dif: {},
      drift: {},
    },
    datasetVersion: 'dataset-1',
    datasetChecksum: 'a'.repeat(64),
    calibrationJobId: null,
    modelImplementationVersion: 'calibration-v1',
    elementContentChecksum: 'b'.repeat(64),
    createdById: 'author',
    approvedById: 'reviewer',
    approvedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function prepared(
  assignments: Array<{
    id: number
    elementVersion: number
    levelId?: number
  }>,
  {
    nodeWeight = 1,
    nodeQuestionCap = null,
  }: { nodeWeight?: number; nodeQuestionCap?: number | null } = {}
) {
  return {
    tree: { id: 'tree' },
    nodes: [
      {
        id: 31,
        parentId: null,
        enabled: true,
        weight: nodeWeight,
        questionCap: nodeQuestionCap,
      },
    ],
    coverages: [
      {
        id: 1,
        leafNodeId: 31,
        levelId: 21,
        targetItemCount: 1,
        enabled: true,
      },
    ],
    assignments: assignments.map(({ id, elementVersion, levelId }) => ({
      id,
      elementId: 100 + id,
      elementName: `Element ${id}`,
      elementVersion,
      leafNodeId: 31,
      levelId: levelId ?? 21,
      enabled: true,
      available: true,
      controlledAnswerReady: true,
    })),
    readiness: {
      ready: true,
      errors: [],
      warnings: [],
      coverages: [],
      rootReachability: [],
      enabledRootCount: 1,
      enabledLeafCount: 1,
      enabledAssignmentCount: assignments.length,
      expectedQuestionCount: assignments.length,
      estimatedDurationMinutes: assignments.length,
    },
  } as never
}

function connectedResearchPrepared() {
  return prepared([
    { id: 1, elementVersion: 2, levelId: 21 },
    { id: 2, elementVersion: 2, levelId: 21 },
    { id: 3, elementVersion: 2, levelId: 21 },
    { id: 4, elementVersion: 2, levelId: 22 },
    { id: 5, elementVersion: 2, levelId: 22 },
    { id: 6, elementVersion: 2, levelId: 22 },
    { id: 7, elementVersion: 2, levelId: 21 },
    { id: 8, elementVersion: 2, levelId: 21 },
    { id: 9, elementVersion: 2, levelId: 22 },
    { id: 10, elementVersion: 2, levelId: 21 },
  ])
}

function connectedResearchCalibrations() {
  return Array.from({ length: 10 }, (_, index) => {
    const assignmentId = index + 1
    return calibration({
      assignmentId,
      elementId: 100 + assignmentId,
      elementVersion: 2,
      status:
        assignmentId >= 8
          ? DB.AdaptiveItemCalibrationStatus.PROVISIONAL
          : DB.AdaptiveItemCalibrationStatus.CALIBRATED,
    })
  })
}

function underProvisionedResearchPrepared() {
  return prepared([
    { id: 1, elementVersion: 2, levelId: 21 },
    { id: 2, elementVersion: 2, levelId: 21 },
    { id: 3, elementVersion: 2, levelId: 22 },
    { id: 4, elementVersion: 2, levelId: 22 },
    { id: 5, elementVersion: 2, levelId: 21 },
    { id: 6, elementVersion: 2, levelId: 22 },
  ])
}

function underProvisionedResearchCalibrations() {
  return Array.from({ length: 6 }, (_, index) => {
    const assignmentId = index + 1
    return calibration({
      assignmentId,
      elementId: 100 + assignmentId,
      elementVersion: 2,
      status:
        assignmentId >= 5
          ? DB.AdaptiveItemCalibrationStatus.PROVISIONAL
          : DB.AdaptiveItemCalibrationStatus.CALIBRATED,
    })
  })
}
