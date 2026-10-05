import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_COMPETENCE_MARKER_COLORS,
  ADAPTIVE_LEVEL_MARKER_COLOR,
  contrastRatio,
  getAdaptiveLevelBandColors,
  getAdaptiveLevelColorSpecs,
  getAdaptiveLevelColors,
  getAdaptiveLevelGroupEnds,
  relativeLuminance,
} from '../src/components/practiceQuiz/adaptive/adaptiveLevelPalette'

const cefrSublevels = [
  'Under A2',
  ...['A2', 'B1', 'B2', 'C1', 'C2'].flatMap((main) =>
    [1, 2, 3].map((sub) => `${main}.${sub}`)
  ),
]

function labelSets() {
  const sets: string[][] = [cefrSublevels, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']]
  for (let count = 2; count <= 30; count += 1) {
    sets.push(Array.from({ length: count }, (_, i) => `Level ${i + 1}`))
    sets.push(
      Array.from(
        { length: count },
        (_, i) =>
          `${String.fromCharCode(65 + Math.floor(i / 3))}.${(i % 3) + 1}`
      )
    )
  }
  return sets
}

describe('adaptive level palette', () => {
  it('never repeats a color for 2 to 30 levels, grouped or not', () => {
    for (const labels of labelSets()) {
      expect(new Set(getAdaptiveLevelColors(labels)).size).toBe(labels.length)
    }
  })

  it('uses one hue as a light-to-dark ramp in level order', () => {
    for (const labels of labelSets()) {
      const specs = getAdaptiveLevelColorSpecs(labels).filter(
        ({ chroma }) => chroma > 0.01
      )
      expect(new Set(specs.map(({ hue }) => hue)).size).toBe(1)
      const luminances = getAdaptiveLevelColors(labels)
        .filter(
          (_, index) => getAdaptiveLevelColorSpecs(labels)[index]!.chroma > 0.01
        )
        .map(relativeLuminance)
      for (let index = 1; index < specs.length; index += 1) {
        expect(specs[index]!.lightness).toBeLessThan(
          specs[index - 1]!.lightness
        )
        expect(luminances[index]).toBeLessThan(luminances[index - 1]!)
      }
    }
  })

  it('shows main levels by a larger lightness step than sublevels', () => {
    const specs = getAdaptiveLevelColorSpecs(cefrSublevels)
    expect(specs).toHaveLength(16)
    const step = (index: number) =>
      specs[index - 1]!.lightness - specs[index]!.lightness
    // A2.1 -> A2.2 (sublevel) vs. A2.3 -> B1.1 (main level).
    expect(step(4)).toBeGreaterThan(step(2) * 1.5)
    expect(step(2)).toBeCloseTo(step(3))
    expect(
      getAdaptiveLevelGroupEnds(
        cefrSublevels.map((label, order) => ({ label, order }))
      )
    ).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
    // Ungrouped labels have no group separators.
    expect(
      getAdaptiveLevelGroupEnds([
        { label: 'Basic', order: 0 },
        { label: 'Advanced', order: 1 },
      ])
    ).toEqual([false, false])
  })

  it('renders an unprefixed lowest level as a neutral gray', () => {
    const [under] = getAdaptiveLevelColors(cefrSublevels)
    const [r, g, b] = [1, 3, 5].map((offset) =>
      Number.parseInt(under!.slice(offset, offset + 2), 16)
    ) as [number, number, number]
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(8)
    expect(getAdaptiveLevelColorSpecs(cefrSublevels)[0]!.group).toBeNull()
  })

  it('keeps the estimate marker and competence markers readable on every band', () => {
    for (const labels of labelSets()) {
      for (const color of getAdaptiveLevelColors(labels)) {
        expect(
          contrastRatio(color, ADAPTIVE_LEVEL_MARKER_COLOR)
        ).toBeGreaterThan(4.5)
        for (const marker of ADAPTIVE_COMPETENCE_MARKER_COLORS) {
          expect(contrastRatio(color, marker)).toBeGreaterThan(4.5)
        }
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
