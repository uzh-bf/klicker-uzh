import { describe, expect, it } from 'vitest'
import {
  resolveEffectiveItemParameters as resolveEffectiveItemParametersInternal,
  type AdaptiveCalibrationStatus,
  type AdaptiveItemCalibration,
  type AdaptiveItemModel,
} from '../src/calibration.js'
import {
  DEFAULT_DISCRIMINATION,
  MAX_ABSOLUTE_THETA,
  MAX_DISCRIMINATION,
  deriveGuessingParameter,
} from '../src/core.js'

type ResolverInput = Parameters<
  typeof resolveEffectiveItemParametersInternal
>[0]

function resolveEffectiveItemParameters(
  input: Omit<ResolverInput, 'elementVersion'> & {
    elementVersion?: number
  }
) {
  return resolveEffectiveItemParametersInternal({
    elementVersion: 4,
    ...input,
  })
}

function createCalibration(
  overrides: Partial<AdaptiveItemCalibration> = {}
): AdaptiveItemCalibration {
  return {
    id: 'calibration-1',
    status: 'CALIBRATED',
    model: 'TWO_PL',
    discrimination: 1.1,
    difficulty: 0.35,
    guessing: 0,
    elementVersion: 4,
    ...overrides,
  }
}

describe('adaptive item calibration', () => {
  it('uses only approved exact-version calibrations for Diagnostic', () => {
    expect(
      resolveEffectiveItemParameters({
        calibration: createCalibration(),
        provisionalDifficulty: 0,
        itemType: 'NUMERICAL',
      })
    ).toEqual({
      model: 'TWO_PL',
      discrimination: 1.1,
      difficulty: 0.35,
      guessing: 0,
      contributesToDiagnosticEstimate: true,
    })
  })

  it('rejects a calibration from a different published element version', () => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: createCalibration({ elementVersion: 4 }),
        elementVersion: 5,
        provisionalDifficulty: 0,
        itemType: 'NUMERICAL',
      })
    ).toThrowError(
      'Calibration element version must match the published element version.'
    )
  })

  it.each([
    'PROVISIONAL',
    'PILOT',
    'FLAGGED',
    'RETIRED',
  ] as const satisfies readonly AdaptiveCalibrationStatus[])(
    'excludes %s parameters from Diagnostic estimation',
    (status) => {
      const resolved = resolveEffectiveItemParameters({
        calibration: createCalibration({
          id: `calibration-${status}`,
          status,
          discrimination: 2,
          difficulty: 2.5,
        }),
        provisionalDifficulty: -1.5,
        provisionalDiscrimination: 1.4,
        itemType: 'NUMERICAL',
      })

      expect(resolved).toEqual({
        model: 'TWO_PL',
        discrimination: 1.4,
        difficulty: -1.5,
        guessing: 0,
        contributesToDiagnosticEstimate: false,
      })
    }
  )

  it('uses the core default discrimination for provisional parameters', () => {
    expect(
      resolveEffectiveItemParameters({
        calibration: null,
        provisionalDifficulty: 1.5,
        itemType: 'FREE_TEXT',
      })
    ).toEqual({
      model: 'TWO_PL',
      discrimination: DEFAULT_DISCRIMINATION,
      difficulty: 1.5,
      guessing: 0,
      contributesToDiagnosticEstimate: false,
    })
  })

  it('accepts exact package bounds', () => {
    expect(
      resolveEffectiveItemParameters({
        calibration: createCalibration({
          discrimination: MAX_DISCRIMINATION,
          difficulty: MAX_ABSOLUTE_THETA,
        }),
        provisionalDifficulty: -MAX_ABSOLUTE_THETA,
        provisionalDiscrimination: MAX_DISCRIMINATION,
        itemType: 'NUMERICAL',
      })
    ).toMatchObject({
      discrimination: MAX_DISCRIMINATION,
      difficulty: MAX_ABSOLUTE_THETA,
      contributesToDiagnosticEstimate: true,
    })
  })

  it.each([
    ['SC', 5],
    ['MC', 4],
    ['KPRIM', 4],
  ] as const)(
    'derives fixed guessing for provisional %s items',
    (type, count) => {
      expect(
        resolveEffectiveItemParameters({
          calibration: null,
          provisionalDifficulty: 0,
          itemType: type,
          choiceCount: count,
        })
      ).toMatchObject({
        model: 'THREE_PL_FIXED_C',
        guessing: deriveGuessingParameter({ type, choiceCount: count }),
        contributesToDiagnosticEstimate: false,
      })
    }
  )

  it.each([
    ['NUMERICAL', 'TWO_PL', 0],
    ['FREE_TEXT', 'TWO_PL', 0],
    ['SC', 'THREE_PL_FIXED_C', 0.25],
    ['MC', 'THREE_PL_FIXED_C', 1 / 15],
    ['KPRIM', 'THREE_PL_FIXED_C', 1 / 16],
  ] as const)(
    'accepts a compatible calibrated %s model',
    (itemType, model, guessing) => {
      expect(
        resolveEffectiveItemParameters({
          calibration: createCalibration({ model, guessing }),
          provisionalDifficulty: -2,
          itemType,
          choiceCount: 4,
        })
      ).toMatchObject({
        model,
        guessing,
        contributesToDiagnosticEstimate: true,
      })
    }
  )

  it.each([
    ['NUMERICAL', 'THREE_PL_FIXED_C'],
    ['FREE_TEXT', 'THREE_PL_FIXED_C'],
    ['SC', 'TWO_PL'],
    ['MC', 'TWO_PL'],
    ['KPRIM', 'TWO_PL'],
  ] as const satisfies readonly (readonly [string, AdaptiveItemModel])[])(
    'rejects incompatible %s and %s combinations',
    (itemType, model) => {
      expect(() =>
        resolveEffectiveItemParameters({
          calibration: createCalibration({ model }),
          provisionalDifficulty: 0,
          itemType: itemType as 'NUMERICAL',
          choiceCount:
            itemType === 'SC' || itemType === 'MC' || itemType === 'KPRIM'
              ? 4
              : undefined,
        })
      ).toThrowError('Calibration model is incompatible with the item type.')
    }
  )

  it('rejects calibrated guessing values that differ from the core rule', () => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: createCalibration({
          model: 'THREE_PL_FIXED_C',
          guessing: 0.2,
        }),
        provisionalDifficulty: 0,
        itemType: 'SC',
        choiceCount: 4,
      })
    ).toThrowError(
      'Calibration guessing must match the item-type guessing parameter.'
    )
  })

  it.each([undefined, null, 1, 1.5, Number.NaN])(
    'rejects malformed choice counts before deriving guessing: %s',
    (choiceCount) => {
      expect(() =>
        resolveEffectiveItemParameters({
          calibration: null,
          provisionalDifficulty: 0,
          itemType: 'MC',
          choiceCount,
        })
      ).toThrowError(
        'Choice count is required and must be an integer of at least 2 for choice items.'
      )
    }
  )

  it.each([2, 3, 5])(
    'requires exactly four statements for KPRIM: %s',
    (choiceCount) => {
      expect(() =>
        resolveEffectiveItemParameters({
          calibration: null,
          provisionalDifficulty: 0,
          itemType: 'KPRIM',
          choiceCount,
        })
      ).toThrowError('KPRIM items must contain exactly 4 statements.')
    }
  )

  it('rejects unsupported deserialized item types', () => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: null,
        provisionalDifficulty: 0,
        itemType: 'CONTENT' as 'NUMERICAL',
      })
    ).toThrowError('Adaptive item type is not supported.')
  })

  it('rejects malformed calibration identity and status values', () => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: createCalibration({ id: '   ' }),
        provisionalDifficulty: 0,
        itemType: 'NUMERICAL',
      })
    ).toThrowError('Calibration ID must not be empty.')

    expect(() =>
      resolveEffectiveItemParameters({
        calibration: createCalibration({
          status: 'UNKNOWN' as AdaptiveCalibrationStatus,
        }),
        provisionalDifficulty: 0,
        itemType: 'NUMERICAL',
      })
    ).toThrowError('Calibration status is not supported.')
  })

  it.each([
    { discrimination: 0 },
    { discrimination: Number.NaN },
    { discrimination: MAX_DISCRIMINATION + 0.01 },
    { difficulty: Number.POSITIVE_INFINITY },
    { difficulty: MAX_ABSOLUTE_THETA + 0.01 },
    { guessing: Number.NaN },
    { guessing: -0.01 },
    { guessing: 1 },
    { elementVersion: -1 },
    { elementVersion: 0 },
    { elementVersion: 1.5 },
  ])('rejects malformed calibration parameters: %o', (overrides) => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: createCalibration(overrides),
        provisionalDifficulty: 0,
        itemType: 'NUMERICAL',
      })
    ).toThrowError(TypeError)
  })

  it('validates non-approved calibration rows before falling back', () => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: createCalibration({
          status: 'PILOT',
          discrimination: 0,
        }),
        provisionalDifficulty: 0,
        itemType: 'NUMERICAL',
      })
    ).toThrowError(TypeError)
  })

  it.each([
    { elementVersion: 0, provisionalDifficulty: 0 },
    { provisionalDifficulty: Number.NaN },
    { provisionalDifficulty: MAX_ABSOLUTE_THETA + 0.01 },
    { provisionalDifficulty: 0, provisionalDiscrimination: 0 },
    {
      provisionalDifficulty: 0,
      provisionalDiscrimination: MAX_DISCRIMINATION + 0.01,
    },
  ])('rejects malformed provisional parameters: %o', (parameters) => {
    expect(() =>
      resolveEffectiveItemParameters({
        calibration: null,
        itemType: 'NUMERICAL',
        ...parameters,
      })
    ).toThrowError(TypeError)
  })

  it('does not mutate a supplied calibration record', () => {
    const calibration = Object.freeze(createCalibration())
    const before = structuredClone(calibration)

    resolveEffectiveItemParameters({
      calibration,
      provisionalDifficulty: 0,
      itemType: 'NUMERICAL',
    })

    expect(calibration).toEqual(before)
  })
})
