import { describe, expect, it } from 'vitest'
import {
  getAdaptiveEstimatedLevelRange,
  getAdaptiveProfileIndication,
} from '../src/components/practiceQuiz/adaptive/adaptiveResultUncertainty'

const levelBands = [
  { label: 'A', order: 0, startPosition: 0, endPosition: 0.5 },
  { label: 'B', order: 1, startPosition: 0.5, endPosition: 1 },
]

describe('student estimated level range', () => {
  it('does not invent a range when estimates are unavailable', () => {
    expect(
      getAdaptiveEstimatedLevelRange({
        lowerPosition: null,
        upperPosition: null,
        levelBands,
      })
    ).toBeNull()
    expect(
      getAdaptiveEstimatedLevelRange({
        lowerPosition: NaN,
        upperPosition: 0.7,
        levelBands,
      })
    ).toBeNull()
  })
  it('maps bounds across levels and within one level', () => {
    expect(
      getAdaptiveEstimatedLevelRange({
        lowerPosition: 0.2,
        upperPosition: 0.8,
        levelBands,
      })
    ).toEqual({ lowerLevelLabel: 'A', upperLevelLabel: 'B' })
    expect(
      getAdaptiveEstimatedLevelRange({
        lowerPosition: 0.1,
        upperPosition: 0.3,
        levelBands,
      })
    ).toEqual({ lowerLevelLabel: 'A', upperLevelLabel: 'A' })
  })
  it('omits results without valid level bands', () => {
    expect(
      getAdaptiveEstimatedLevelRange({
        lowerPosition: 0.2,
        upperPosition: 0.8,
        levelBands: [],
      })
    ).toBeNull()
  })
})

describe('provisional profile indication', () => {
  const estimate = {
    responseCount: 1,
    classification: 'INSUFFICIENT_EVIDENCE',
    position: 0.6,
    lowerPosition: 0.1,
    upperPosition: 0.9,
    levelBands,
  }
  it('offers an explicitly presentational point and range after one response', () => {
    expect(getAdaptiveProfileIndication(estimate)).toEqual({
      levelLabel: 'B',
      lowerLevelLabel: 'A',
      upperLevelLabel: 'B',
    })
    expect(estimate.classification).toBe('INSUFFICIENT_EVIDENCE')
  })
  it('does not report a prior as evidence or publish unsupported results', () => {
    expect(
      getAdaptiveProfileIndication({ ...estimate, responseCount: 0 })
    ).toBeNull()
    expect(
      getAdaptiveProfileIndication({
        ...estimate,
        classification: 'RESEARCH_ONLY',
      })
    ).toBeNull()
    expect(
      getAdaptiveProfileIndication({
        ...estimate,
        classification: 'POOL_LIMITED',
      })
    ).toBeNull()
    expect(
      getAdaptiveProfileIndication({ ...estimate, position: Infinity })
    ).toBeNull()
  })
})
