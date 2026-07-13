import { describe, expect, it } from 'vitest'
import {
  describeAdaptiveTrajectoryPoint,
  findAdaptiveLevelBandLabel,
  prepareAdaptiveResultLevelBands,
  prepareAdaptiveResultTrajectory,
  summarizeAdaptiveTrajectory,
} from '../src/index.js'

const bands = [
  { label: 'Foundation', order: 0, startPosition: 0, endPosition: 0.4 },
  { label: 'Developing', order: 1, startPosition: 0.4, endPosition: 0.7 },
  { label: 'Secure', order: 2, startPosition: 0.7, endPosition: 1 },
]

describe('adaptive result presentation', () => {
  it('sorts, de-duplicates, clamps, and skips missing trajectory points', () => {
    const points = prepareAdaptiveResultTrajectory({
      trajectory: [
        {
          order: 2,
          position: 1.2,
          lowerPosition: 0.9,
          upperPosition: 1.4,
          levelLabel: 'Secure',
        },
        {
          order: 1,
          position: Number.NaN,
          lowerPosition: 0,
          upperPosition: 1,
        },
        {
          order: 2,
          position: 0.8,
          lowerPosition: 0.95,
          upperPosition: 0.6,
          levelLabel: 'Secure',
        },
      ],
      overall: {
        answeredQuestions: 2,
        position: null,
        lowerPosition: null,
        upperPosition: null,
        levelLabel: null,
      },
    })

    expect(points).toEqual([
      expect.objectContaining({
        order: 2,
        position: 0.8,
        lowerPosition: 0.6,
        upperPosition: 0.95,
        interval: [0.6, 0.95],
        isEndpoint: true,
      }),
    ])
  })

  it('forces the chart endpoint to match the server-authored headline', () => {
    const points = prepareAdaptiveResultTrajectory({
      trajectory: [
        {
          order: 1,
          position: 0.45,
          lowerPosition: 0.2,
          upperPosition: 0.8,
          levelLabel: 'Developing',
        },
      ],
      overall: {
        answeredQuestions: 1,
        position: 0.4,
        lowerPosition: 0.3,
        upperPosition: 0.6,
        levelLabel: 'Foundation',
      },
    })

    expect(points.at(-1)).toMatchObject({
      order: 1,
      position: 0.4,
      lowerPosition: 0.3,
      upperPosition: 0.6,
      levelLabel: 'Foundation',
      isEndpoint: true,
    })
  })

  it('places a sparse trajectory endpoint at the authoritative response count', () => {
    const points = prepareAdaptiveResultTrajectory({
      trajectory: [
        {
          order: 2,
          position: 0.45,
          lowerPosition: 0.2,
          upperPosition: 0.8,
          levelLabel: 'Developing',
        },
      ],
      overall: {
        answeredQuestions: 5,
        position: 0.72,
        lowerPosition: 0.55,
        upperPosition: 0.88,
        levelLabel: 'Secure',
      },
    })

    expect(points.map(({ order }) => order)).toEqual([2, 5])
    expect(points.at(-1)).toMatchObject({
      order: 5,
      levelLabel: 'Secure',
      isEndpoint: true,
    })
    expect(summarizeAdaptiveTrajectory(points).questionCount).toBe(5)
  })

  it('trusts explicit server labels at boundaries for every mapping rule', () => {
    const nearest = prepareAdaptiveResultTrajectory({
      trajectory: [],
      overall: {
        answeredQuestions: 4,
        position: 0.4,
        lowerPosition: 0.35,
        upperPosition: 0.45,
        levelLabel: 'Developing',
      },
    })
    const mastery = prepareAdaptiveResultTrajectory({
      trajectory: [],
      overall: {
        answeredQuestions: 4,
        position: 0.4,
        lowerPosition: 0.35,
        upperPosition: 0.45,
        levelLabel: 'Foundation',
      },
    })

    expect(nearest[0]?.levelLabel).toBe('Developing')
    expect(mastery[0]?.levelLabel).toBe('Foundation')
    expect(findAdaptiveLevelBandLabel(0.4, bands)).toBe('Developing')
  })

  it('normalizes visual bands and describes tooltip uncertainty without raw estimates', () => {
    const normalizedBands = prepareAdaptiveResultLevelBands([
      ...bands,
      { label: 'Invalid', order: 3, startPosition: 0.8, endPosition: 0.8 },
    ])
    const [point] = prepareAdaptiveResultTrajectory({
      trajectory: [],
      overall: {
        answeredQuestions: 7,
        position: 0.72,
        lowerPosition: 0.35,
        upperPosition: 0.82,
        levelLabel: 'Secure',
      },
    })

    expect(normalizedBands).toHaveLength(3)
    expect(describeAdaptiveTrajectoryPoint(point!, normalizedBands)).toEqual({
      question: 7,
      levelLabel: 'Secure',
      lowerLevelLabel: 'Foundation',
      upperLevelLabel: 'Secure',
    })
  })

  it('builds a stable textual fallback for classified and missing points', () => {
    const points = prepareAdaptiveResultTrajectory({
      trajectory: [
        {
          order: 1,
          position: 0.2,
          lowerPosition: 0,
          upperPosition: 0.7,
          levelLabel: null,
        },
        {
          order: 3,
          position: 0.75,
          lowerPosition: 0.55,
          upperPosition: 0.9,
          levelLabel: 'Secure',
        },
      ],
      overall: {
        answeredQuestions: 3,
        position: 0.75,
        lowerPosition: 0.55,
        upperPosition: 0.9,
        levelLabel: 'Secure',
      },
    })

    expect(summarizeAdaptiveTrajectory(points)).toEqual({
      questionCount: 3,
      firstLevelLabel: 'Secure',
      finalLevelLabel: 'Secure',
      classifiedPointCount: 1,
    })
  })
})
