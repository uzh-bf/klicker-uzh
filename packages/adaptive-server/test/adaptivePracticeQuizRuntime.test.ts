import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import {
  type AdaptiveRuntimePoolItem,
  type AdaptiveRuntimeSettings,
  gradeAdaptiveResponse,
  normalizeRuntimeEstimateForChart,
  serializeAdaptiveParticipantElement,
} from '../src/services/adaptivePracticeQuizRuntime.js'

const levels = [
  { id: 1, label: 'Basic', order: 0 },
  { id: 2, label: 'Independent', order: 1 },
  { id: 3, label: 'Advanced', order: 2 },
]
const settings: AdaptiveRuntimeSettings = {
  totalQuestionCap: 20,
  perLeafQuestionCap: 10,
  minQuestionsPerLeaf: 1,
  classificationZ: 1.28,
  topInformationRatio: 0.8,
  levelMappingRule: DB.AdaptiveLevelMappingRule.NEAREST,
  thetaRange: { min: -3, max: 3 },
}

describe('adaptive practice quiz runtime', () => {
  it('normalizes widening and narrowing trajectory intervals without raw values', () => {
    const points = [0.9, 0.4, 0.7].map((standardError) =>
      normalizeRuntimeEstimateForChart({
        estimate: { theta: 0.25, standardError },
        settings,
      })
    )

    for (const point of points) {
      expect(point).not.toBeNull()
      expect(point!.lowerPosition).toBeLessThanOrEqual(point!.position)
      expect(point!.position).toBeLessThanOrEqual(point!.upperPosition)
      expect(point!.lowerPosition).toBeGreaterThanOrEqual(0)
      expect(point!.upperPosition).toBeLessThanOrEqual(1)
      expect(point).not.toHaveProperty('theta')
      expect(point).not.toHaveProperty('standardError')
    }
    const widths = points.map(
      (point) => point!.upperPosition - point!.lowerPosition
    )
    expect(widths[1]).toBeLessThan(widths[0]!)
    expect(widths[2]).toBeGreaterThan(widths[1]!)
  })

  it('reads the server flag and defaults to hiding answers when unset', () => {
    const item = poolItem(1, [1, 2], 2, 2, 0)
    try {
      vi.stubEnv('ADAPTIVE_QUIZ_SHOW_SOLUTIONS', undefined)
      expect(serializeAdaptiveParticipantElement(item).testingInfo).toBeNull()
      vi.stubEnv('ADAPTIVE_QUIZ_SHOW_SOLUTIONS', 'true')
      expect(
        serializeAdaptiveParticipantElement(item).testingInfo?.solution
      ).toEqual({
        choiceIndices: [0],
        answers: [],
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('only exposes testing solutions for the exact true flag', () => {
    const items = [
      poolItem(1, [1, 2], 2, 2, 0),
      numericalPoolItem(),
      freeTextPoolItem(),
    ]
    for (const flag of ['', 'false', 'TRUE', '1']) {
      for (const item of items) {
        expect(
          serializeAdaptiveParticipantElement(item, flag).testingInfo
        ).toBeNull()
      }
    }
    expect(
      serializeAdaptiveParticipantElement(items[0]!, 'true').testingInfo
        ?.solution
    ).toEqual({ choiceIndices: [0], answers: [] })
    expect(
      serializeAdaptiveParticipantElement(items[1]!, 'true').testingInfo
        ?.solution
    ).toEqual({ choiceIndices: [], answers: ['0'] })
    expect(
      serializeAdaptiveParticipantElement(items[2]!, 'true').testingInfo
        ?.solution
    ).toEqual({ choiceIndices: [], answers: ['zurich'] })
    const enabled = serializeAdaptiveParticipantElement(items[0]!, 'true')
    expect(collectKeys(enabled.options)).not.toContain('correct')
    expect(collectKeys(enabled)).not.toContain('feedback')
  })

  it('grades supported snapshots and never serializes hidden answer data', () => {
    const choices = poolItem(1, [1, 2], 2, 2, 0)
    const result = gradeAdaptiveResponse({
      poolItem: choices,
      input: { choiceIndices: [0] },
    })
    expect(result).toMatchObject({ score: 1, correct: true })

    const safe = serializeAdaptiveParticipantElement(choices)
    const keys = collectKeys(safe)
    expect(keys).not.toContain('correct')
    expect(keys).not.toContain('solutions')
    expect(keys).not.toContain('feedback')
    expect(keys).not.toContain('difficulty')
    expect(keys).not.toContain('guessing')
    expect(keys).not.toContain('discrimination')

    const numerical = numericalPoolItem()
    expect(
      gradeAdaptiveResponse({
        poolItem: numerical,
        input: { numericalResponse: '0' },
      })
    ).toMatchObject({ score: 1, correct: true })
    expect(
      gradeAdaptiveResponse({
        poolItem: numerical,
        input: { numericalResponse: '1' },
      })
    ).toMatchObject({ score: 0, correct: false })

    const decimalNumerical = numericalPoolItem(0.5)
    expect(
      gradeAdaptiveResponse({
        poolItem: decimalNumerical,
        input: { numericalResponse: '0,500' },
      })
    ).toMatchObject({ score: 1, correct: true })
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: decimalNumerical,
        input: { numericalResponse: '1,200' },
      })
    ).toThrowError('unambiguous')
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: numericalPoolItem(0.25),
        input: { numericalResponse: '25%' },
      })
    ).toThrowError('unambiguous')
    // Legacy saved flags must not re-enable percentage conversion.
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: numericalPoolItem(0.25, true),
        input: { numericalResponse: '25%' },
      })
    ).toThrowError('unambiguous')

    const freeText = freeTextPoolItem()
    expect(
      gradeAdaptiveResponse({
        poolItem: freeText,
        input: { freeTextResponse: '  ZÜRICH  ' },
      })
    ).toMatchObject({ score: 1, correct: true })

    const uncontrolled = freeTextPoolItem()
    uncontrolled.elementData = {
      ...uncontrolled.elementData,
      options: { solutions: [' '] },
    } as ElementData
    expect(() =>
      gradeAdaptiveResponse({
        poolItem: uncontrolled,
        input: { freeTextResponse: 'Zurich' },
      })
    ).toThrowError('no controlled answer')
  })

  it('accepts an all-false KPRIM key as a controlled answer', () => {
    const item = poolItem(1, [1, 2], 2, 2, 0)
    item.elementType = DB.ElementType.KPRIM
    item.elementData = {
      ...item.elementData,
      type: DB.ElementType.KPRIM,
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'A', correct: false },
          { ix: 1, value: 'B', correct: false },
          { ix: 2, value: 'C', correct: false },
          { ix: 3, value: 'D', correct: false },
        ],
      },
    } as ElementData

    expect(
      gradeAdaptiveResponse({ poolItem: item, input: { choiceIndices: [] } })
    ).toMatchObject({ score: 1, correct: true })
  })

  it('rejects an empty MC response to match the non-empty guessing space', () => {
    const item = poolItem(1, [1, 2], 2, 2, 0)
    item.elementType = DB.ElementType.MC
    item.elementData = {
      ...item.elementData,
      type: DB.ElementType.MC,
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 10, value: 'A', correct: true },
          { ix: 20, value: 'B', correct: false },
          { ix: 30, value: 'C', correct: true },
        ],
      },
    } as ElementData

    expect(() =>
      gradeAdaptiveResponse({ poolItem: item, input: { choiceIndices: [] } })
    ).toThrowError('at least one selected choice')
    expect(
      gradeAdaptiveResponse({
        poolItem: item,
        input: { choiceIndices: [10, 30] },
      })
    ).toMatchObject({ score: 1, correct: true })
  })
})

function poolItem(
  id: number,
  nodePath: number[],
  leafNodeId: number,
  levelId: number,
  difficulty: number
): AdaptiveRuntimePoolItem {
  return {
    id,
    sourceAssignmentId: id,
    elementId: id,
    elementVersion: 1,
    elementType: DB.ElementType.SC,
    elementName: `Question ${id}`,
    elementData: {
      id: `${id}-v1`,
      elementId: id,
      type: DB.ElementType.SC,
      name: `Question ${id}`,
      content: `Question ${id}`,
      pointsMultiplier: 1,
      options: {
        displayMode: 'LIST',
        choices: [
          { ix: 0, value: 'Correct', correct: true, feedback: 'Hidden' },
          { ix: 1, value: 'Incorrect', correct: false },
        ],
      },
    } as ElementData,
    leafNodeId,
    nodePath,
    nodeNamePath: nodePath.map((nodeId) => `Node ${nodeId}`),
    levelId,
    levelLabel: levels.find((level) => level.id === levelId)!.label,
    levelOrder: levels.find((level) => level.id === levelId)!.order,
    discrimination: 1.2,
    difficulty,
    guessing: 0.5,
    enablePercentInput: false,
  }
}

function numericalPoolItem(
  target = 0,
  enablePercentInput = false
): AdaptiveRuntimePoolItem {
  const item = poolItem(10, [1, 2], 2, 2, 0)
  return {
    ...item,
    elementType: DB.ElementType.NUMERICAL,
    elementData: {
      ...item.elementData,
      type: DB.ElementType.NUMERICAL,
      options: { solutionRanges: [{ min: target, max: target }] },
    } as ElementData,
    guessing: 0,
    enablePercentInput,
  }
}

function freeTextPoolItem(): AdaptiveRuntimePoolItem {
  const item = poolItem(11, [1, 2], 2, 2, 0)
  return {
    ...item,
    elementType: DB.ElementType.FREE_TEXT,
    elementData: {
      ...item.elementData,
      type: DB.ElementType.FREE_TEXT,
      options: { solutions: ['zurich'] },
    } as ElementData,
    guessing: 0,
  }
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => [
    key,
    ...collectKeys(nested),
  ])
}
