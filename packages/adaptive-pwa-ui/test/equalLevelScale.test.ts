import { describe, expect, it } from 'vitest'
import { createEqualLevelScale } from '../src/components/practiceQuiz/adaptive/equalLevelScale'

const boundaries = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1]
const source = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((label, order) => ({
  label,
  order,
  startPosition: boundaries[order]!,
  endPosition: boundaries[order + 1]!,
}))

describe('equal level display scale', () => {
  it('gives every level the same space and preserves all boundary positions', () => {
    const { bands, project } = createEqualLevelScale(source)
    bands.forEach((band, index) => {
      expect(band.endPosition - band.startPosition).toBeCloseTo(1 / 6)
      expect(project(boundaries[index]!)).toBeCloseTo(index / 6)
      expect(
        project((source[index]!.startPosition + source[index]!.endPosition) / 2)
      ).toBeCloseTo((index + 0.5) / 6)
    })
    expect(project(1)).toBe(1)
    expect(source[0]!.endPosition).toBe(0.3)
  })
  it('preserves the levels spanned by an interval including the outer tails', () => {
    const { project } = createEqualLevelScale(source)
    expect(project(0.15)).toBeCloseTo(1 / 12)
    expect(project(0.85)).toBeCloseTo(11 / 12)
    expect(project(0.45)).toBeCloseTo(2.5 / 6)
    expect(project(-1)).toBe(0)
    expect(project(2)).toBe(1)
  })
  it('handles empty, unordered, and degenerate input without dividing by zero', () => {
    expect(createEqualLevelScale([]).project(0.4)).toBe(0.4)
    const scale = createEqualLevelScale([...source].reverse())
    expect(scale.bands[0]!.label).toBe('A1')
    expect(scale.project(0.5)).toBeCloseTo(0.5)
    expect(
      createEqualLevelScale([
        { label: 'bad', order: 0, startPosition: 0, endPosition: 0 },
      ]).bands
    ).toEqual([])
  })
})
