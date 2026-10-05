import { describe, expect, it } from 'vitest'
import {
  getAdaptiveEdgeBandText,
  getAdaptiveEstimatedLevelText,
  getAdaptiveRangeText,
  getAdaptiveResultState,
} from '../src/components/practiceQuiz/adaptive/adaptiveResultState'

const LABELS = [
  'Under A2',
  ...['A2', 'B1', 'B2', 'C1', 'C2'].flatMap((main) =>
    [1, 2, 3].map((sub) => `${main}.${sub}`)
  ),
]
// "Under A2" has no published elements (bottom edge of the measurable range).
const bands = LABELS.map((label, order) => ({
  label,
  order,
  startPosition: order / LABELS.length,
  endPosition: (order + 1) / LABELS.length,
  hasElements: order > 0,
}))
const at = (label: string, fraction = 0.5) =>
  (LABELS.indexOf(label) + fraction) / LABELS.length

function state(
  classification: string,
  point: string,
  lower: string,
  upper: string,
  extra: { levelLabel?: string; responseCount?: number } = {}
) {
  return getAdaptiveResultState({
    classification,
    responseCount: extra.responseCount ?? 50,
    levelLabel: extra.levelLabel ?? null,
    position: at(point),
    lowerPosition: at(lower, 0.2),
    upperPosition: at(upper, 0.8),
    levelBands: bands,
  })
}

describe('result presentation state', () => {
  it('is DETERMINED for a classified level', () => {
    expect(
      state('CLASSIFIED', 'B1.3', 'B1.2', 'B2.1', { levelLabel: 'B1.3' })
    ).toMatchObject({ kind: 'DETERMINED', levelLabel: 'B1.3' })
  })

  it('is ESTIMATED with the sublevel for a finished, narrow estimate', () => {
    expect(
      state('INSUFFICIENT_EVIDENCE', 'B1.2', 'B1.1', 'B1.3')
    ).toMatchObject({
      kind: 'ESTIMATED',
      levelLabel: 'B1.2',
    })
  })

  it('keeps the sublevel for a moderately wide estimate', () => {
    // B1.1 - B2.1: 4 of 16 levels, medium width; never coarsened to "B1".
    expect(
      state('INSUFFICIENT_EVIDENCE', 'B1.2', 'B1.1', 'B2.1')
    ).toMatchObject({
      kind: 'ESTIMATED',
      levelLabel: 'B1.2',
    })
  })

  it('is NOT_ENOUGH_ANSWERS only without a usable estimate', () => {
    expect(state('INSUFFICIENT_EVIDENCE', 'B1.2', 'A2.1', 'C1.3')).toEqual({
      kind: 'NOT_ENOUGH_ANSWERS',
    })
    expect(
      getAdaptiveResultState({
        classification: 'INSUFFICIENT_EVIDENCE',
        responseCount: 0,
        levelBands: bands,
      })
    ).toEqual({ kind: 'NOT_ENOUGH_ANSWERS' })
  })

  it('keeps other outcomes', () => {
    expect(state('BETWEEN_LEVELS', 'B1.2', 'B1.1', 'B1.3').kind).toBe('OTHER')
  })
})

describe('edge-aware labels', () => {
  it('names the lowest measurable band for an unmeasured edge band', () => {
    expect(
      getAdaptiveEdgeBandText({ levelLabel: 'Under A2', levelBands: bands })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.levelOrBelow',
      values: { level: 'A2.1' },
    })
    expect(
      getAdaptiveEdgeBandText({ levelLabel: 'B1.2', levelBands: bands })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.levelExact',
      values: { level: 'B1.2' },
    })
  })

  it('folds an unmeasured edge band into the range sentence', () => {
    expect(
      getAdaptiveRangeText({
        lowerLevelLabel: 'Under A2',
        upperLevelLabel: 'A2.3',
        levelBands: bands,
      })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.likelyOrBelow',
      values: { level: 'A2.3' },
    })
    expect(
      getAdaptiveRangeText({
        lowerLevelLabel: 'B1.1',
        upperLevelLabel: 'B2.1',
        levelBands: bands,
      })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.likelyRange',
      values: { lower: 'B1.1', upper: 'B2.1' },
    })
  })

  it('never names an unmeasured edge band for an estimate', () => {
    const estimate = state(
      'INSUFFICIENT_EVIDENCE',
      'Under A2',
      'Under A2',
      'A2.3'
    )
    if (estimate.kind !== 'ESTIMATED') throw new Error('expected an estimate')
    expect(
      getAdaptiveEstimatedLevelText({
        state: estimate,
        levelBands: bands,
        rough: false,
      })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.estimatedLevel',
      level: {
        key: 'pwa.practiceQuiz.adaptive.profile.levelBelowRange',
        values: { level: 'A2.1' },
      },
    })
  })

  it('names the sublevel inside the measurable range', () => {
    const estimate = state('INSUFFICIENT_EVIDENCE', 'B1.2', 'B1.1', 'B2.1')
    if (estimate.kind !== 'ESTIMATED') throw new Error('expected an estimate')
    expect(
      getAdaptiveEstimatedLevelText({
        state: estimate,
        levelBands: bands,
        rough: false,
      })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.estimatedLevel',
      level: {
        key: 'pwa.practiceQuiz.adaptive.profile.levelExact',
        values: { level: 'B1.2' },
      },
    })
  })
})
