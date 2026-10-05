import { describe, expect, it } from 'vitest'
import {
  getAdaptiveMainLevelSegments,
  getAdaptiveProfileCertainty,
  getAdaptiveRangeWidth,
  getAdaptiveRoughEstimateDisplay,
  getAdaptiveWidthCertainty,
} from '../src/components/practiceQuiz/adaptive/adaptiveProfileCertainty'

const LABELS = [
  'Under A2',
  ...['A2', 'B1', 'B2', 'C1', 'C2'].flatMap((main) =>
    [1, 2, 3].map((sub) => `${main}.${sub}`)
  ),
]
const cefr = LABELS.map((label, order) => ({
  label,
  order,
  startPosition: order / LABELS.length,
  endPosition: (order + 1) / LABELS.length,
}))
const at = (label: string, fraction = 0.5) =>
  (LABELS.indexOf(label) + fraction) / LABELS.length

function width(lower: string, upper: string) {
  return getAdaptiveRangeWidth({
    lowerPosition: at(lower, 0.2),
    upperPosition: at(upper, 0.8),
    levelBands: cefr,
  })
}

describe('plausible range width', () => {
  it('counts levels, scale fraction and main levels', () => {
    expect(width('B1.3', 'C1.1')).toEqual({
      lowerLevelLabel: 'B1.3',
      upperLevelLabel: 'C1.1',
      levelCount: 5,
      totalLevels: 16,
      levelFraction: 5 / 16,
      mainLevelCount: 3,
    })
    expect(width('Under A2', 'A2.2')?.mainLevelCount).toBe(2)
  })
  it('returns null without usable bounds or bands', () => {
    expect(
      getAdaptiveRangeWidth({
        lowerPosition: null,
        upperPosition: 0.5,
        levelBands: cefr,
      })
    ).toBeNull()
    expect(
      getAdaptiveRangeWidth({
        lowerPosition: 0.1,
        upperPosition: 0.5,
        levelBands: [],
      })
    ).toBeNull()
  })
  it('accepts swapped bounds', () => {
    expect(
      getAdaptiveRangeWidth({
        lowerPosition: at('B2.1'),
        upperPosition: at('B1.1'),
        levelBands: cefr,
      })?.levelCount
    ).toBe(4)
  })
})

describe('width certainty thresholds', () => {
  it.each([
    ['B1.3', 'B1.3', 'HIGH'],
    ['B1.2', 'B2.1', 'HIGH'],
    ['B1.1', 'B1.3', 'HIGH'],
    ['B1.1', 'B2.1', 'MEDIUM'],
    ['B1.3', 'C1.1', 'MEDIUM'],
    ['A2.3', 'B2.3', 'LOW'],
    ['B1.1', 'B2.3', 'LOW'],
    ['Under A2', 'C2.3', 'LOW'],
  ] as const)('%s – %s is %s', (lower, upper, expected) => {
    expect(getAdaptiveWidthCertainty(width(lower, upper)!)).toBe(expected)
  })
  it('caps by main levels even when the fraction is small', () => {
    // Synthetic width (e.g. a scale with single-sublevel main levels) that
    // isolates the main-level rule.
    expect(
      getAdaptiveWidthCertainty({
        levelCount: 3,
        levelFraction: 3 / 16,
        mainLevelCount: 3,
      })
    ).toBe('MEDIUM')
  })
  it('treats a single level as high on short scales', () => {
    const twoLevels = [
      { label: 'A', order: 0, startPosition: 0, endPosition: 0.5 },
      { label: 'B', order: 1, startPosition: 0.5, endPosition: 1 },
    ]
    const one = getAdaptiveRangeWidth({
      lowerPosition: 0.1,
      upperPosition: 0.3,
      levelBands: twoLevels,
    })!
    const both = getAdaptiveRangeWidth({
      lowerPosition: 0.1,
      upperPosition: 0.9,
      levelBands: twoLevels,
    })!
    expect(getAdaptiveWidthCertainty(one)).toBe('HIGH')
    expect(getAdaptiveWidthCertainty(both)).toBe('LOW')
  })
})

describe('row certainty respects the classification', () => {
  it('never shows a determined level with low certainty', () => {
    expect(
      getAdaptiveProfileCertainty({
        classification: 'CLASSIFIED',
        width: width('A2.3', 'B2.3'),
      })
    ).toBe('MEDIUM')
    expect(
      getAdaptiveProfileCertainty({
        classification: 'CLASSIFIED',
        width: width('B1.2', 'B2.1'),
      })
    ).toBe('HIGH')
  })
  it('never shows between-levels results with high certainty', () => {
    expect(
      getAdaptiveProfileCertainty({
        classification: 'BETWEEN_LEVELS',
        width: width('B2.3', 'C1.1'),
      })
    ).toBe('MEDIUM')
  })
  it('keeps rough estimates at low certainty and hides missing estimates', () => {
    expect(
      getAdaptiveProfileCertainty({
        classification: 'INSUFFICIENT_EVIDENCE',
        width: width('B2.2', 'B2.3'),
      })
    ).toBe('LOW')
    expect(
      getAdaptiveProfileCertainty({
        classification: 'POOL_LIMITED',
        width: width('B2.2', 'B2.3'),
      })
    ).toBeNull()
    expect(
      getAdaptiveProfileCertainty({ classification: 'CLASSIFIED', width: null })
    ).toBeNull()
  })
})

describe('rough estimate display', () => {
  it('hides a level when the range is too wide', () => {
    expect(
      getAdaptiveRoughEstimateDisplay({
        levelLabel: 'C2.3',
        width: width('Under A2', 'C2.3'),
        levelBands: cefr,
      })
    ).toEqual({ kind: 'notEnoughAnswers' })
    expect(
      getAdaptiveRoughEstimateDisplay({
        levelLabel: 'A2.3',
        width: width('Under A2', 'B2.1'),
        levelBands: cefr,
      })
    ).toEqual({ kind: 'notEnoughAnswers' })
  })
  it('falls back to the main level when moderately wide', () => {
    expect(
      getAdaptiveRoughEstimateDisplay({
        levelLabel: 'B1.2',
        width: width('B1.1', 'B2.1'),
        levelBands: cefr,
      })
    ).toEqual({ kind: 'mainLevel', levelLabel: 'B1' })
  })
  it('keeps the sublevel when the range is narrow', () => {
    expect(
      getAdaptiveRoughEstimateDisplay({
        levelLabel: 'B2.3',
        width: width('B2.2', 'C1.1'),
        levelBands: cefr,
      })
    ).toEqual({ kind: 'level', levelLabel: 'B2.3' })
  })
  it('shows nothing without a rough level or range', () => {
    expect(
      getAdaptiveRoughEstimateDisplay({
        levelLabel: null,
        width: width('B2.2', 'C1.1'),
        levelBands: cefr,
      })
    ).toEqual({ kind: 'notEnoughAnswers' })
    expect(
      getAdaptiveRoughEstimateDisplay({
        levelLabel: 'B1.1',
        width: null,
        levelBands: cefr,
      })
    ).toEqual({ kind: 'notEnoughAnswers' })
  })
})

describe('main level segments', () => {
  it('groups CEFR sublevels and keeps the neutral edge separate', () => {
    expect(getAdaptiveMainLevelSegments(cefr)).toEqual([
      { label: 'Under A2', grouped: false, startIndex: 0, endIndex: 0 },
      { label: 'A2', grouped: true, startIndex: 1, endIndex: 3 },
      { label: 'B1', grouped: true, startIndex: 4, endIndex: 6 },
      { label: 'B2', grouped: true, startIndex: 7, endIndex: 9 },
      { label: 'C1', grouped: true, startIndex: 10, endIndex: 12 },
      { label: 'C2', grouped: true, startIndex: 13, endIndex: 15 },
    ])
  })
  it('keeps one segment per level on ungrouped scales', () => {
    expect(
      getAdaptiveMainLevelSegments([
        { label: 'Novice' },
        { label: 'Advanced' },
      ]).map((segment) => segment.label)
    ).toEqual(['Novice', 'Advanced'])
  })
})
