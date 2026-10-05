import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_LEVEL_MARKER_COLOR,
  contrastRatio,
  getAdaptiveLevelBandColors,
  getAdaptiveLevelColorSpecs,
  getAdaptiveLevelColors,
  relativeLuminance,
} from '../src/components/practiceQuiz/adaptive/adaptiveLevelPalette'

const cefrSublevels = [
  'Under A2',
  ...['A2', 'B1', 'B2', 'C1', 'C2'].flatMap((main) =>
    [1, 2, 3].map((sub) => `${main}.${sub}`)
  ),
]

describe('adaptive level palette', () => {
  it('never repeats a color for 2 to 30 levels, grouped or not', () => {
    for (let count = 2; count <= 30; count += 1) {
      const plain = Array.from({ length: count }, (_, i) => `Level ${i + 1}`)
      expect(new Set(getAdaptiveLevelColors(plain)).size).toBe(count)
      const grouped = Array.from(
        { length: count },
        (_, i) =>
          `${String.fromCharCode(65 + Math.floor(i / 3))}.${(i % 3) + 1}`
      )
      expect(new Set(getAdaptiveLevelColors(grouped)).size).toBe(count)
    }
  })

  it('gives each CEFR main level one hue family and steps sublevels by lightness', () => {
    const specs = getAdaptiveLevelColorSpecs(cefrSublevels)
    const colors = getAdaptiveLevelColors(cefrSublevels)
    expect(specs).toHaveLength(16)
    expect(specs[0]!.group).toBeNull()
    const groupHues: number[] = []
    for (let group = 0; group < 5; group += 1) {
      const members = specs.slice(1 + group * 3, 4 + group * 3)
      expect(new Set(members.map(({ group }) => group)).size).toBe(1)
      expect(new Set(members.map(({ hue }) => hue)).size).toBe(1)
      expect(members[0]!.lightness).toBeGreaterThan(members[1]!.lightness)
      expect(members[1]!.lightness).toBeGreaterThan(members[2]!.lightness)
      const luminances = colors
        .slice(1 + group * 3, 4 + group * 3)
        .map(relativeLuminance)
      expect(luminances[0]).toBeGreaterThan(luminances[1]!)
      expect(luminances[1]).toBeGreaterThan(luminances[2]!)
      groupHues.push(members[0]!.hue)
    }
    // Neighbouring main levels use clearly different, ordered hues.
    for (let index = 1; index < groupHues.length; index += 1) {
      expect(groupHues[index - 1]! - groupHues[index]!).toBeGreaterThan(40)
    }
  })

  it('renders an unprefixed lowest level as a neutral gray', () => {
    const [under] = getAdaptiveLevelColors(cefrSublevels)
    const [r, g, b] = [1, 3, 5].map((offset) =>
      Number.parseInt(under!.slice(offset, offset + 2), 16)
    ) as [number, number, number]
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20)
  })

  it('falls back to an ordered ramp for unprefixed or single-prefix labels', () => {
    for (const labels of [
      ['Basic', 'Independent', 'Proficient'],
      ['L1', 'L2', 'L3', 'L4'],
      ['A2.1', 'Middle', 'B1.1'],
    ]) {
      const colors = getAdaptiveLevelColors(labels)
      const luminances = colors.map(relativeLuminance)
      for (let index = 1; index < luminances.length; index += 1) {
        expect(luminances[index]).toBeLessThan(luminances[index - 1]!)
      }
    }
  })

  it('keeps the current-estimate marker readable on every band', () => {
    for (const labels of [
      cefrSublevels,
      Array.from({ length: 30 }, (_, i) => `Level ${i + 1}`),
      ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    ]) {
      for (const color of getAdaptiveLevelColors(labels)) {
        expect(
          contrastRatio(color, ADAPTIVE_LEVEL_MARKER_COLOR)
        ).toBeGreaterThan(4.5)
      }
    }
  })

  it('maps band colors by level order regardless of input order', () => {
    const bands = [
      { label: 'B1', order: 2 },
      { label: 'A1', order: 0 },
      { label: 'A2', order: 1 },
    ]
    const colors = getAdaptiveLevelBandColors(bands)
    const byOrder = getAdaptiveLevelColors(['A1', 'A2', 'B1'])
    expect(colors).toEqual([byOrder[2], byOrder[0], byOrder[1]])
    expect(getAdaptiveLevelColors([])).toEqual([])
    expect(getAdaptiveLevelColors(['Only'])).toHaveLength(1)
  })
})
