import { describe, expect, test } from 'vitest'
import {
  buildItemBankMap,
  filterItemBankItems,
  type ItemBankAssignment,
  type ItemBankCalibration,
} from '../src/components/resources/competenceTrees/itemBankMapModel'

const levels = [
  {
    order: 0,
    label: 'Foundation',
    lowerBound: null,
    itemDifficultyPrior: -1,
    sourceLevelId: 10,
  },
  {
    order: 1,
    label: 'Advanced',
    lowerBound: 0,
    itemDifficultyPrior: 1,
    sourceLevelId: 20,
  },
]

function assignment(
  id: number,
  levelId: number,
  elementVersion = 1
): ItemBankAssignment {
  return {
    id,
    elementId: id + 100,
    elementName: `Element ${id}`,
    elementType: id % 2 === 0 ? 'SC' : 'NUMERICAL',
    elementVersion,
    levelId,
    enabled: true,
  }
}

function calibration(
  assignmentId: number,
  difficulty: number,
  status: ItemBankCalibration['status'] = 'CALIBRATED',
  version = 1,
  elementVersion = 1
): ItemBankCalibration {
  return {
    assignmentId,
    elementVersion,
    version,
    status,
    discrimination: 1.2,
    difficulty,
    guessing: 0,
  }
}

describe('buildItemBankMap', () => {
  test('uses the latest calibration for the current element version', () => {
    const result = buildItemBankMap({
      assignments: [assignment(1, 10, 2)],
      calibrations: [
        calibration(1, -2, 'CALIBRATED', 1, 2),
        calibration(1, 0.4, 'FLAGGED', 2, 2),
      ],
      levels,
      gridMin: -3,
      gridMax: 3,
      gridStep: 0.5,
    })

    expect(result.items[0]).toMatchObject({
      position: 0.4,
      positionSource: 'CALIBRATED',
      status: 'FLAGGED',
      levelLabel: 'Foundation',
    })
    expect(result.counts.FLAGGED).toBe(1)
  })

  test('falls back to the expected difficulty when calibration is stale', () => {
    const result = buildItemBankMap({
      assignments: [assignment(1, 20, 2)],
      calibrations: [calibration(1, -2, 'CALIBRATED', 1, 1)],
      levels,
      gridMin: -3,
      gridMax: 3,
      gridStep: 0.5,
    })

    expect(result.items[0]).toMatchObject({
      position: 1,
      positionSource: 'EXPECTED',
      status: 'MISSING',
      levelLabel: 'Advanced',
    })
    expect(result.counts.MISSING).toBe(1)
  })

  test('flags cut neighborhoods without calibrated enabled items', () => {
    const covered = buildItemBankMap({
      assignments: [assignment(1, 10)],
      calibrations: [calibration(1, 0.4)],
      levels,
      gridMin: -3,
      gridMax: 3,
      gridStep: 0.5,
      cutNeighborhood: 0.5,
    })
    const missing = buildItemBankMap({
      assignments: [assignment(1, 10)],
      calibrations: [calibration(1, 1.5)],
      levels,
      gridMin: -3,
      gridMax: 3,
      gridStep: 0.5,
      cutNeighborhood: 0.5,
    })

    expect(covered.cuts[0].hasNearbyCalibratedItems).toBe(true)
    expect(covered.missingCutNeighborhoods).toHaveLength(0)
    expect(missing.missingCutNeighborhoods).toMatchObject([
      { levelLabel: 'Advanced', position: 0 },
    ])
  })

  test('builds a finite information-coverage curve from calibrated items only', () => {
    const result = buildItemBankMap({
      assignments: [assignment(1, 10), assignment(2, 20)],
      calibrations: [calibration(1, -0.5), calibration(2, 0.5, 'PROVISIONAL')],
      levels,
      gridMin: -2,
      gridMax: 2,
      gridStep: 0.5,
    })

    expect(result.information).toHaveLength(9)
    expect(result.information.every((point) => point.information >= 0)).toBe(
      true
    )
    expect(
      Math.max(...result.information.map((point) => point.information))
    ).toBeGreaterThan(0)
  })

  test('normalizes an invalid scale domain', () => {
    const result = buildItemBankMap({
      assignments: [],
      calibrations: [],
      levels,
      gridMin: 3,
      gridMax: -3,
      gridStep: 0,
    })

    expect(result.domain).toStrictEqual([-6, 6])
    expect(result.information.length).toBeGreaterThan(0)
  })

  test('filters the accessible bank list across item metadata', () => {
    const result = buildItemBankMap({
      assignments: [assignment(1, 10), assignment(2, 20)],
      calibrations: [calibration(1, -0.5), calibration(2, 0.5, 'FLAGGED')],
      levels,
      gridMin: -2,
      gridMax: 2,
      gridStep: 0.5,
    })

    expect(filterItemBankItems(result.items, ' advanced ')).toMatchObject([
      { assignmentId: 2 },
    ])
    expect(filterItemBankItems(result.items, 'flagged')).toMatchObject([
      { assignmentId: 2 },
    ])
    expect(filterItemBankItems(result.items, '')).toHaveLength(2)
  })
})
