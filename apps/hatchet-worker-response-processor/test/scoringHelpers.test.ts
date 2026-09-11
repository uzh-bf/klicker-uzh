import { describe, expect, it } from 'vitest'
import {
  getCaseStudyQuestionPoints,
  getCaseStudyQuestionPointsDetails,
  getChoicesQuestionPoints,
  getChoicesQuestionPointsDetails,
  getFreeTextQuestionPoints,
  getFreeTextQuestionPointsDetails,
  getNumericalQuestionPoints,
  getNumericalQuestionPointsDetails,
  getSelectionQuestionPoints,
  getSelectionQuestionPointsDetails,
  hasGradableFreeTextAnswer,
  hasGradableNumericalAnswer,
  isFullyCorrect,
} from '@/src/processors/helpers.js'

// ! Characterization battery for the response-processor scoring helpers.
//
// The expected values are derived by hand from the current implementation
// (helpers.ts + @klicker-uzh/grading) and pin the observable scoring
// behavior, including the per-type differences that a future consolidation
// must preserve:
// - choices/selection/case-study award via `pointsPercentage`, numerical and
//   free text via `getsMaxPoints` (equivalent at the produced percentages)
// - XP is 10 iff the percentage is exactly 1, otherwise 0 (null coerces to 0)
// - the bonus declines linearly from maxBonusPoints to zero after
//   timeToZeroBonus seconds, measured against firstResponseReceivedAt
// With empty instance info the defaults are: maxBonus 45, timeToZeroBonus 20
// (slope 2.25/s), defaultPoints 10, defaultCorrectPoints 5.

const RESPONSE_TIMESTAMP = 1_000_000

const instanceInfoWith = (values: Record<string, string> = {}) => ({
  ...values,
})

const choicesResponse = (selected: number[]) => ({
  choices: [0, 1, 2, 3].map((ix) => ({ ix, selected: selected.includes(ix) })),
})

const choicesResponse5 = (selected: number[]) => ({
  choices: [0, 1, 2, 3, 4].map((ix) => ({
    ix,
    selected: selected.includes(ix),
  })),
})

describe('characterization of the response processor scoring helpers', () => {
  describe('single choice (choices helpers with type SC)', () => {
    const base = {
      type: 'SC' as const,
      choiceCount: '4',
      parsedSolutions: [0],
      instanceInfo: instanceInfoWith(),
      responseTimestamp: RESPONSE_TIMESTAMP,
    }

    it('awards correctness and full first-response bonus for a correct answer', () => {
      const result = getChoicesQuestionPoints({
        ...base,
        response: choicesResponse([0]),
        basePoints: 'false',
      })

      // correctness 1 * 5 + bonus 1 * 45 (no prior response -> zero timing)
      expect(result).toEqual({
        pointsAwarded: 50,
        xpAwarded: 10,
        pointsPercentage: 1,
      })
    })

    it('adds base points when the basePoints flag is set', () => {
      const result = getChoicesQuestionPoints({
        ...base,
        response: choicesResponse([0]),
        basePoints: 'true',
      })

      expect(result.pointsAwarded).toBe(60)
    })

    it('awards zero points and xp for a wrong answer', () => {
      const result = getChoicesQuestionPoints({
        ...base,
        response: choicesResponse([1]),
        basePoints: 'false',
      })

      expect(result).toEqual({
        pointsAwarded: 0,
        xpAwarded: 0,
        pointsPercentage: 0,
      })
    })

    it('decomposition into correctness and bonus points matches the total', () => {
      const result = getChoicesQuestionPointsDetails({
        ...base,
        response: choicesResponse([0]),
      })

      expect(result).toEqual({
        correctnessPoints: 5,
        bonusPoints: 45,
        xpAwarded: 10,
        pointsPercentage: 1,
      })
    })

    it('declines the bonus linearly against the first response timestamp', () => {
      // 10s after the first response: bonus 45 - 2.25 * 10 = 22.5; total 5 + 22.5 = 27.5 -> 28
      const result = getChoicesQuestionPoints({
        ...base,
        response: choicesResponse([0]),
        firstResponseReceivedAt: String(RESPONSE_TIMESTAMP - 10_000),
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(28)
    })

    it('floors the bonus at zero once the decline window has passed', () => {
      // 30s after the first response: 45 - 2.25 * 30 < 0 -> bonus 0
      const result = getChoicesQuestionPoints({
        ...base,
        response: choicesResponse([0]),
        firstResponseReceivedAt: String(RESPONSE_TIMESTAMP - 30_000),
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(5)
    })
  })

  describe('multiple choice (choices helpers with type MC)', () => {
    it('awards partial credit with a hamming-distance penalty', () => {
      // solution [0, 1], response selects only ix 0 -> distance 1 of 5 -> 1 - 2 * 1/5 = 0.6
      const result = getChoicesQuestionPoints({
        type: 'MC' as const,
        choiceCount: '5',
        parsedSolutions: [0, 1],
        instanceInfo: instanceInfoWith(),
        responseTimestamp: RESPONSE_TIMESTAMP,
        response: choicesResponse5([0]),
        basePoints: 'false',
      })

      // correctness 0.6 * 5 = 3, bonus 0.6 * 45 = 27, total 30 (rounded)
      expect(result.pointsAwarded).toBe(30)
      expect(result.pointsPercentage).toBeCloseTo(0.6)
      expect(result.xpAwarded).toBe(0)
    })
  })

  describe('k-prim (choices helpers with type KPRIM)', () => {
    it('awards half credit for a single wrong statement', () => {
      // the solution lists the indexes of the true statements (0 and 1);
      // selecting statement 2 as well is a single deviation -> half credit
      const response = {
        choices: [
          { ix: 0, selected: true },
          { ix: 1, selected: true },
          { ix: 2, selected: true },
          { ix: 3, selected: false },
        ],
      }

      const result = getChoicesQuestionPoints({
        type: 'KPRIM' as const,
        choiceCount: '4',
        parsedSolutions: [0, 1],
        instanceInfo: instanceInfoWith(),
        responseTimestamp: RESPONSE_TIMESTAMP,
        response,
        basePoints: 'false',
      })

      // distance 1 -> percentage 0.5; correctness 2.5 + bonus 22.5 = 25
      expect(result.pointsAwarded).toBe(25)
      expect(result.pointsPercentage).toBe(0.5)
      expect(result.xpAwarded).toBe(0)
    })
  })

  describe('numerical', () => {
    const exactBase = {
      parsedSolutions: [5] as Array<number | string>,
      instanceInfo: instanceInfoWith(),
      responseTimestamp: RESPONSE_TIMESTAMP,
    }

    it('grades exact solutions via the getsMaxPoints path', () => {
      const result = getNumericalQuestionPoints({
        ...exactBase,
        response: { value: '5' },
        basePoints: 'true',
      })

      // correctness 5 + bonus 45 + base 10
      expect(result.pointsAwarded).toBe(60)
      expect(result.pointsPercentage).toBe(1)
      expect(result.xpAwarded).toBe(10)
    })

    it('grades solution ranges when no exact solutions are defined', () => {
      const result = getNumericalQuestionPoints({
        ...exactBase,
        parsedSolutions: [{ min: 1, max: 10 }] as any,
        response: { value: '5' },
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(50)
    })

    it('awards zero for a wrong numeric answer', () => {
      const result = getNumericalQuestionPoints({
        ...exactBase,
        response: { value: '99' },
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(0)
      expect(result.pointsPercentage).toBe(0)
      expect(result.xpAwarded).toBe(0)
    })

    it('decomposition matches the total for a correct answer', () => {
      const result = getNumericalQuestionPointsDetails({
        ...exactBase,
        response: { value: '5' },
      })

      expect(result).toEqual({
        correctnessPoints: 5,
        bonusPoints: 45,
        xpAwarded: 10,
        pointsPercentage: 1,
      })
    })
  })

  describe('free text', () => {
    const base = {
      parsedSolutions: ['Hello World'],
      instanceInfo: instanceInfoWith(),
      responseTimestamp: RESPONSE_TIMESTAMP,
    }

    it('matches case-insensitively after trimming the response', () => {
      const result = getFreeTextQuestionPoints({
        ...base,
        response: { value: '  hello world  ' },
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(50)
      expect(result.pointsPercentage).toBe(1)
      expect(result.xpAwarded).toBe(10)
    })

    it('awards only base points when no solutions are defined (percentage null)', () => {
      const result = getFreeTextQuestionPoints({
        ...base,
        parsedSolutions: [],
        response: { value: 'anything' },
        basePoints: 'true',
      })

      expect(result.pointsAwarded).toBe(10)
      expect(result.pointsPercentage).toBeNull()
      expect(result.xpAwarded).toBe(0)
    })

    it('decomposition yields zero correctness and bonus without solutions', () => {
      const result = getFreeTextQuestionPointsDetails({
        ...base,
        parsedSolutions: [],
        response: { value: 'anything' },
      })

      expect(result).toEqual({
        correctnessPoints: 0,
        bonusPoints: 0,
        xpAwarded: 0,
        pointsPercentage: null,
      })
    })
  })

  describe('selection', () => {
    const base = {
      instanceInfo: instanceInfoWith({ numberOfInputs: '2' }),
      responseTimestamp: RESPONSE_TIMESTAMP,
      parsedSolutions: [0, 1],
    }

    it('awards fractional credit over the number of inputs, ignoring skipped fields', () => {
      const result = getSelectionQuestionPoints({
        ...base,
        // -1 marks a skipped input; only ix 0 is correct -> 1 of 2 inputs
        response: { selection: [0, -1] },
        basePoints: 'false',
      })

      // correctness 0.5 * 5 = 2.5 + bonus 0.5 * 45 = 22.5 -> 25 (rounded)
      expect(result.pointsAwarded).toBe(25)
      expect(result.pointsPercentage).toBe(0.5)
      expect(result.xpAwarded).toBe(0)
    })

    it('awards full credit when every input is answered correctly', () => {
      const result = getSelectionQuestionPoints({
        ...base,
        response: { selection: [0, 1] },
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(50)
      expect(result.xpAwarded).toBe(10)
    })

    it('decomposition keeps the fractional percentage', () => {
      const result = getSelectionQuestionPointsDetails({
        ...base,
        response: { selection: [0, -1] },
      })

      expect(result.correctnessPoints).toBe(2.5)
      expect(result.bonusPoints).toBe(22.5)
      expect(result.pointsPercentage).toBe(0.5)
    })
  })

  describe('case study', () => {
    const solutions = [
      {
        caseId: 'case-1',
        itemSolutions: [
          {
            itemId: 'item-1',
            criteriaSolutions: [
              { criterionId: 'criterion-1', min: 0, max: 5 },
              { criterionId: 'criterion-2', min: 0, max: 5 },
            ],
          },
        ],
      },
    ] as any

    const base = {
      parsedSolutions: solutions,
      instanceInfo: instanceInfoWith(),
      responseTimestamp: RESPONSE_TIMESTAMP,
    }

    const correctAssessment = {
      assessment: [
        {
          caseId: 'case-1',
          itemResponses: [
            {
              itemId: 'item-1',
              criterionResponses: [
                { criterionId: 'criterion-1', response: 3 },
                { criterionId: 'criterion-2', response: 4 },
              ],
            },
          ],
        },
      ] as any,
    }

    const partialAssessment = {
      assessment: [
        {
          caseId: 'case-1',
          itemResponses: [
            {
              itemId: 'item-1',
              criterionResponses: [
                { criterionId: 'criterion-1', response: 3 },
                { criterionId: 'criterion-2', response: 50 }, // out of range
              ],
            },
          ],
        },
      ] as any,
    }

    it('awards full credit when all criteria are within range', () => {
      const result = getCaseStudyQuestionPoints({
        ...base,
        response: correctAssessment,
        basePoints: 'false',
      })

      expect(result.pointsAwarded).toBe(50)
      expect(result.pointsPercentage).toBe(1)
      expect(result.xpAwarded).toBe(10)
    })

    it('awards fractional credit for partially correct assessments', () => {
      const result = getCaseStudyQuestionPoints({
        ...base,
        response: partialAssessment,
        basePoints: 'false',
      })

      // percentage 0.5 -> correctness 2.5 + bonus 22.5 = 25
      expect(result.pointsAwarded).toBe(25)
      expect(result.pointsPercentage).toBe(0.5)
      expect(result.xpAwarded).toBe(0)
    })

    it('decomposition matches the total for a correct assessment', () => {
      const result = getCaseStudyQuestionPointsDetails({
        ...base,
        response: correctAssessment,
      })

      expect(result).toEqual({
        correctnessPoints: 5,
        bonusPoints: 45,
        xpAwarded: 10,
        pointsPercentage: 1,
      })
    })
  })

  describe('instance-info defaults and multipliers', () => {
    it('falls back to the default points configuration on empty instance values', () => {
      const result = getChoicesQuestionPoints({
        type: 'SC' as const,
        choiceCount: '4',
        parsedSolutions: [0],
        instanceInfo: instanceInfoWith({
          maxBonusPoints: '',
          timeToZeroBonus: '',
          defaultPoints: '',
          defaultCorrectPoints: '',
        }),
        responseTimestamp: RESPONSE_TIMESTAMP,
        response: choicesResponse([0]),
        basePoints: 'false',
      })

      // same as the default configuration: 5 + 45
      expect(result.pointsAwarded).toBe(50)
    })

    it('applies a points multiplier to correctness and bonus points', () => {
      const result = getChoicesQuestionPointsDetails({
        type: 'SC' as const,
        choiceCount: '4',
        parsedSolutions: [0],
        instanceInfo: instanceInfoWith(),
        responseTimestamp: RESPONSE_TIMESTAMP,
        pointsMultiplier: '2',
        response: choicesResponse([0]),
      })

      expect(result.correctnessPoints).toBe(10)
      expect(result.bonusPoints).toBe(90)
    })

    it('treats multipliers below one or non-numeric as one', () => {
      const half = getChoicesQuestionPointsDetails({
        type: 'SC' as const,
        choiceCount: '4',
        parsedSolutions: [0],
        instanceInfo: instanceInfoWith(),
        responseTimestamp: RESPONSE_TIMESTAMP,
        pointsMultiplier: '0.5',
        response: choicesResponse([0]),
      })
      expect(half.correctnessPoints).toBe(5)

      const invalid = getChoicesQuestionPointsDetails({
        type: 'SC' as const,
        choiceCount: '4',
        parsedSolutions: [0],
        instanceInfo: instanceInfoWith(),
        responseTimestamp: RESPONSE_TIMESTAMP,
        pointsMultiplier: 'not-a-number',
        response: choicesResponse([0]),
      })
      expect(invalid.correctnessPoints).toBe(5)
    })

    it('yields the full bonus when the recorded first response has identical timing', () => {
      // the caller guards recording via !firstResponseReceivedAt; given a
      // recorded response with zero time difference the bonus is untouched
      const result = getChoicesQuestionPointsDetails({
        type: 'SC' as const,
        choiceCount: '4',
        parsedSolutions: [0],
        instanceInfo: instanceInfoWith(),
        responseTimestamp: RESPONSE_TIMESTAMP,
        firstResponseReceivedAt: String(RESPONSE_TIMESTAMP),
        response: choicesResponse([0]),
      })

      expect(result.bonusPoints).toBe(45)
    })
  })
})

describe('first-response guard predicates', () => {
  // the live-quiz flow combines these per-type predicates with its own
  // !firstResponseReceivedAt check; the variants below intentionally differ
  // between question types and are preserved verbatim
  it('isFullyCorrect accepts only a percentage of exactly one', () => {
    expect(isFullyCorrect(1)).toBe(true)
    expect(isFullyCorrect(0.5)).toBe(false)
    expect(isFullyCorrect(0)).toBe(false)
    expect(isFullyCorrect(null)).toBe(false)
  })

  it('hasGradableNumericalAnswer requires solutions and a non-zero percentage', () => {
    expect(hasGradableNumericalAnswer([5], 1)).toBe(true)
    expect(hasGradableNumericalAnswer([{ min: 1, max: 2 }], 1)).toBe(true)
    expect(hasGradableNumericalAnswer([5], 0)).toBe(false)
    expect(hasGradableNumericalAnswer(undefined, 1)).toBe(false)
    // quirk preserved verbatim: an empty array is truthy, so it counts as
    // gradable in the original guard
    expect(hasGradableNumericalAnswer([], 1)).toBe(true)
  })

  it('hasGradableFreeTextAnswer requires a non-zero percentage', () => {
    expect(hasGradableFreeTextAnswer(1)).toBe(true)
    expect(hasGradableFreeTextAnswer(0.5)).toBe(true)
    expect(hasGradableFreeTextAnswer(0)).toBe(false)
    expect(hasGradableFreeTextAnswer(null)).toBe(false)
  })
})
