import {
  adaptiveCalibrationArtifactSchema,
  adaptiveEmpiricalValidationRequestSchema,
  adaptiveScaleLinkArtifactSchema,
  adaptiveStandardSettingArtifactSchema,
  MAX_ADAPTIVE_SCALE_LINK_ANCHORS,
} from '../src/services/competenceTreeCalibrationArtifact.js'

const checksum = 'a'.repeat(64)
const treeId = '10000000-0000-4000-8000-000000000001'
const scaleVersionId = '10000000-0000-4000-8000-000000000002'

function validCalibrationArtifact() {
  return {
    schemaVersion: 1 as const,
    treeId,
    scaleVersionId,
    datasetVersion: 'dataset-v1',
    datasetChecksum: checksum,
    calibrationJobId: 'job-v1',
    generatedAt: '2026-07-31T10:00:00.000Z',
    modelImplementationVersion: 'mml-1.0.0',
    diagnosticsPolicyVersion: 1,
    calibrations: [
      {
        assignmentId: 10,
        elementVersion: 2,
        model: 'THREE_PL_FIXED_C' as const,
        discrimination: 1.2,
        difficulty: 0.5,
        guessing: 0.25,
        discriminationStandardError: 0.1,
        difficultyStandardError: 0.2,
        responseCount: 100,
        participantCount: 100,
        diagnostics: {
          policyVersion: 1,
          fitStatus: 'PASS' as const,
          difStatus: 'PASS' as const,
          driftStatus: 'PASS' as const,
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

describe('adaptive calibration artifacts', () => {
  it('accepts an exact aggregate-only calibration artifact', () => {
    expect(
      adaptiveCalibrationArtifactSchema.parse(validCalibrationArtifact())
    ).toMatchObject({
      treeId,
      scaleVersionId,
      diagnosticsPolicyVersion: 1,
    })
  })

  it.each(['participantId', 'response', 'email', 'username', 'freeText'])(
    'rejects the raw learner field %s at every strict import boundary',
    (field) => {
      const artifact = validCalibrationArtifact()
      expect(
        adaptiveCalibrationArtifactSchema.safeParse({
          ...artifact,
          calibrations: [{ ...artifact.calibrations[0], [field]: 'private' }],
        }).success
      ).toBe(false)
    }
  )

  it('rejects non-finite, model-inconsistent, and duplicate calibrations', () => {
    const artifact = validCalibrationArtifact()
    const invalid = {
      ...artifact,
      calibrations: [
        {
          ...artifact.calibrations[0],
          model: 'TWO_PL' as const,
          guessing: 0.2,
          difficulty: Number.NaN,
        },
        artifact.calibrations[0],
      ],
    }
    expect(adaptiveCalibrationArtifactSchema.safeParse(invalid).success).toBe(
      false
    )
  })

  it('rejects unknown diagnostics and mismatched policy versions', () => {
    const artifact = validCalibrationArtifact()
    expect(
      adaptiveCalibrationArtifactSchema.safeParse({
        ...artifact,
        calibrations: [
          {
            ...artifact.calibrations[0],
            diagnostics: {
              ...artifact.calibrations[0]!.diagnostics,
              policyVersion: 2,
              codes: ['UNREGISTERED_MESSAGE'],
            },
          },
        ],
      }).success
    ).toBe(false)
  })

  it('limits each synchronous calibration import artifact to 100 items', () => {
    const artifact = validCalibrationArtifact()
    const calibrations = Array.from({ length: 100 }, (_, index) => ({
      ...artifact.calibrations[0]!,
      assignmentId: index + 1,
    }))

    expect(
      adaptiveCalibrationArtifactSchema.safeParse({
        ...artifact,
        calibrations,
      }).success
    ).toBe(true)
    expect(
      adaptiveCalibrationArtifactSchema.safeParse({
        ...artifact,
        calibrations: [
          ...calibrations,
          { ...artifact.calibrations[0]!, assignmentId: 101 },
        ],
      }).success
    ).toBe(false)
  })
})

describe('adaptive standard-setting and scale-link artifacts', () => {
  it('accepts an empty cut rationale for a one-level scale submission', () => {
    expect(
      adaptiveStandardSettingArtifactSchema.safeParse({
        schemaVersion: 1,
        treeId,
        scaleVersionId,
        method: 'BOOKMARK',
        methodVersion: 'bookmark-v1',
        panelSize: 5,
        standardSettingDate: '2026-07-31T10:00:00.000Z',
        cutRationale: [],
        artifactChecksum: checksum,
        artifactKey: 'private/standard-setting.json',
      }).success
    ).toBe(true)
  })

  it('requires unique cut rationales and exact anchor counts', () => {
    expect(
      adaptiveStandardSettingArtifactSchema.safeParse({
        schemaVersion: 1,
        treeId,
        scaleVersionId,
        method: 'BOOKMARK',
        methodVersion: 'bookmark-v1',
        panelSize: 5,
        standardSettingDate: '2026-07-31T10:00:00.000Z',
        cutRationale: [
          { scaleLevelOrder: 1, codes: ['PANEL_CONSENSUS'] },
          { scaleLevelOrder: 1, codes: ['DUPLICATE'] },
        ],
        artifactChecksum: checksum,
        artifactKey: 'private/standard-setting.json',
      }).success
    ).toBe(false)

    const metric = {
      anchorCount: 2,
      intercept: 0.1,
      slope: 1,
      rootMeanSquareError: 0.1,
      interceptStandardError: 0.02,
      slopeStandardError: 0.03,
    }
    expect(
      adaptiveScaleLinkArtifactSchema.safeParse({
        schemaVersion: 1,
        treeId,
        fromScaleVersionId: scaleVersionId,
        toScaleVersionId: '10000000-0000-4000-8000-000000000003',
        method: 'FIXED_ANCHOR',
        implementationVersion: 'link-v1',
        generatedAt: '2026-07-31T10:00:00.000Z',
        anchors: [
          {
            fromCalibrationId: '10000000-0000-4000-8000-000000000004',
            toCalibrationId: '10000000-0000-4000-8000-000000000005',
          },
        ],
        fitMetrics: metric,
        uncertaintyMetrics: metric,
        artifactChecksum: checksum,
        artifactKey: 'private/scale-link.json',
      }).success
    ).toBe(false)
  })

  it('bounds scale-link anchor artifacts before database validation', () => {
    const anchors = Array.from(
      { length: MAX_ADAPTIVE_SCALE_LINK_ANCHORS + 1 },
      (_, index) => ({
        fromCalibrationId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        toCalibrationId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      })
    )
    const metric = {
      anchorCount: anchors.length,
      intercept: 0,
      slope: 1,
      rootMeanSquareError: 0,
      interceptStandardError: 0,
      slopeStandardError: 0,
    }

    expect(
      adaptiveScaleLinkArtifactSchema.safeParse({
        schemaVersion: 1,
        treeId,
        fromScaleVersionId: scaleVersionId,
        toScaleVersionId: '10000000-0000-4000-8000-000000000003',
        method: 'FIXED_ANCHOR',
        implementationVersion: 'link-v1',
        generatedAt: '2026-07-31T10:00:00.000Z',
        anchors,
        fitMetrics: metric,
        uncertaintyMetrics: metric,
        artifactChecksum: checksum,
        artifactKey: 'private/scale-link.json',
      }).success
    ).toBe(false)
  })

  it('rejects reuse of either side of a scale-link anchor', () => {
    const metric = {
      anchorCount: 2,
      intercept: 0,
      slope: 1,
      rootMeanSquareError: 0,
      interceptStandardError: 0,
      slopeStandardError: 0,
    }
    const artifact = {
      schemaVersion: 1,
      treeId,
      fromScaleVersionId: scaleVersionId,
      toScaleVersionId: '10000000-0000-4000-8000-000000000003',
      method: 'FIXED_ANCHOR',
      implementationVersion: 'link-v1',
      generatedAt: '2026-07-31T10:00:00.000Z',
      fitMetrics: metric,
      uncertaintyMetrics: metric,
      artifactChecksum: checksum,
      artifactKey: 'private/scale-link.json',
    }

    for (const anchors of [
      [
        {
          fromCalibrationId: '10000000-0000-4000-8000-000000000004',
          toCalibrationId: '10000000-0000-4000-8000-000000000005',
        },
        {
          fromCalibrationId: '10000000-0000-4000-8000-000000000004',
          toCalibrationId: '10000000-0000-4000-8000-000000000006',
        },
      ],
      [
        {
          fromCalibrationId: '10000000-0000-4000-8000-000000000004',
          toCalibrationId: '10000000-0000-4000-8000-000000000005',
        },
        {
          fromCalibrationId: '10000000-0000-4000-8000-000000000006',
          toCalibrationId: '10000000-0000-4000-8000-000000000005',
        },
      ],
    ]) {
      expect(
        adaptiveScaleLinkArtifactSchema.safeParse({
          ...artifact,
          anchors,
        }).success
      ).toBe(false)
    }
  })
})

describe('adaptive empirical-validation artifacts', () => {
  it('accepts only an opaque sealed-export and criterion reference', () => {
    expect(
      adaptiveEmpiricalValidationRequestSchema.safeParse({
        schemaVersion: 1,
        configId: '10000000-0000-4000-8000-000000000006',
        treeId,
        scaleVersionId,
        exportRequestId: '10000000-0000-4000-8000-000000000007',
        criterionArtifactChecksum: checksum,
        criterionArtifactKey:
          'criteria/tree/export-request/predeclared-criterion.json',
      }).success
    ).toBe(true)
  })

  it.each([
    'aggregateMetrics',
    'stratumMetrics',
    'bankFingerprint',
    'approvedProbabilityThreshold',
    'rows',
    'participantId',
  ])('rejects the client-asserted validation field %s', (field) => {
    expect(
      adaptiveEmpiricalValidationRequestSchema.safeParse({
        schemaVersion: 1,
        configId: '10000000-0000-4000-8000-000000000006',
        treeId,
        scaleVersionId,
        exportRequestId: '10000000-0000-4000-8000-000000000007',
        criterionArtifactChecksum: checksum,
        criterionArtifactKey:
          'criteria/tree/export-request/predeclared-criterion.json',
        [field]: 'client-controlled',
      }).success
    ).toBe(false)
  })
})
