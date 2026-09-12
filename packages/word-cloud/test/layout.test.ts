import { computeWordCloudLayout } from '../src/layout'
import type { LayoutWord, WordCloudWord } from '../src/types'

function overlaps(left: LayoutWord, right: LayoutWord) {
  return (
    Math.abs(left.x - right.x) < (left.width + right.width) / 2 &&
    Math.abs(left.y - right.y) < (left.height + right.height) / 2
  )
}

describe('computeWordCloudLayout', () => {
  const baselineWords: WordCloudWord[] = [
    { text: 'alpha', value: 100 },
    { text: 'beta', value: 50 },
    { text: 'gamma', value: 25 },
    { text: 'delta', value: 12 },
    { text: 'epsilon', value: 6 },
  ]

  it('is deterministic with the same seed', () => {
    const first = computeWordCloudLayout(baselineWords, {
      width: 800,
      height: 500,
      deterministic: true,
      seed: '42',
      minFontSize: 16,
      maxFontSize: 48,
    })
    const second = computeWordCloudLayout(baselineWords, {
      width: 800,
      height: 500,
      deterministic: true,
      seed: '42',
      minFontSize: 16,
      maxFontSize: 48,
    })

    expect(
      first.placed.map((word) => ({
        text: word.text,
        x: word.x,
        y: word.y,
        rotate: word.rotate,
        size: word.fontSize,
      }))
    ).toEqual(
      second.placed.map((word) => ({
        text: word.text,
        x: word.x,
        y: word.y,
        rotate: word.rotate,
        size: word.fontSize,
      }))
    )
  })

  it('does not place overlapping words', () => {
    const result = computeWordCloudLayout(
      Array.from({ length: 28 }, (_, index) => ({
        text: `word-${index + 1}`,
        value: 80 - index,
      })),
      {
        width: 1000,
        height: 650,
        deterministic: true,
        seed: '42',
        minFontSize: 12,
        maxFontSize: 44,
      }
    )

    for (let leftIndex = 0; leftIndex < result.placed.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < result.placed.length;
        rightIndex += 1
      ) {
        const leftWord = result.placed[leftIndex]
        const rightWord = result.placed[rightIndex]
        if (!leftWord || !rightWord) continue
        expect(overlaps(leftWord, rightWord)).toBe(false)
      }
    }
  })

  it('forces single word rotation to 0', () => {
    const result = computeWordCloudLayout([{ text: 'single', value: 10 }], {
      width: 320,
      height: 220,
      deterministic: true,
      seed: '42',
      rotations: 2,
      rotationAngles: [0, -90],
    })

    expect(result.placed).toHaveLength(1)
    expect(result.placed[0]?.rotate).toBe(0)
  })

  it('shrinks font sizes and retries when placement fails', () => {
    const result = computeWordCloudLayout(
      Array.from({ length: 10 }, (_, index) => ({
        text: `dense-word-${index + 1}`,
        value: 50 - index,
      })),
      {
        width: 250,
        height: 120,
        minFontSize: 80,
        maxFontSize: 100,
        shrinkFactor: 0.8,
        maxRelayouts: 10,
        deterministic: true,
        seed: '42',
      }
    )

    expect(result.relayoutCount).toBeGreaterThan(0)
    expect(result.placed.length).toBeGreaterThan(0)
  })

  it('applies scale strategies consistently', () => {
    const words: WordCloudWord[] = [
      { text: 'small', value: 1 },
      { text: 'mid', value: 10 },
      { text: 'large', value: 100 },
    ]

    const linear = computeWordCloudLayout(words, {
      width: 600,
      height: 300,
      scale: 'linear',
      minFontSize: 10,
      maxFontSize: 40,
      rotations: 1,
      deterministic: true,
      seed: '42',
    })
    const sqrt = computeWordCloudLayout(words, {
      width: 600,
      height: 300,
      scale: 'sqrt',
      minFontSize: 10,
      maxFontSize: 40,
      rotations: 1,
      deterministic: true,
      seed: '42',
    })
    const log = computeWordCloudLayout(words, {
      width: 600,
      height: 300,
      scale: 'log',
      minFontSize: 10,
      maxFontSize: 40,
      rotations: 1,
      deterministic: true,
      seed: '42',
    })

    const mapByText = (
      layout: ReturnType<typeof computeWordCloudLayout>
    ): Record<string, number> =>
      Object.fromEntries(
        layout.placed.map((word) => [word.text, word.fontSize])
      )
    const getSize = (source: Record<string, number>, key: string) =>
      source[key] ?? 0
    const linearSizes = mapByText(linear)
    const sqrtSizes = mapByText(sqrt)
    const logSizes = mapByText(log)

    expect(getSize(linearSizes, 'large')).toBeGreaterThan(
      getSize(linearSizes, 'mid')
    )
    expect(getSize(linearSizes, 'mid')).toBeGreaterThan(
      getSize(linearSizes, 'small')
    )
    expect(getSize(sqrtSizes, 'large')).toBeGreaterThan(
      getSize(sqrtSizes, 'mid')
    )
    expect(getSize(sqrtSizes, 'mid')).toBeGreaterThan(
      getSize(sqrtSizes, 'small')
    )
    expect(getSize(logSizes, 'large')).toBeGreaterThan(getSize(logSizes, 'mid'))
    expect(getSize(logSizes, 'mid')).toBeGreaterThan(getSize(logSizes, 'small'))
    expect(getSize(logSizes, 'mid')).toBeGreaterThan(getSize(sqrtSizes, 'mid'))
    expect(getSize(sqrtSizes, 'mid')).toBeGreaterThan(
      getSize(linearSizes, 'mid')
    )
  })

  it('preserves explicit zero values for supported layout options', () => {
    const result = computeWordCloudLayout(baselineWords, {
      width: 500,
      height: 300,
      padding: 0,
      maxRelayouts: 0,
      deterministic: true,
      seed: '42',
    })

    expect(result.settings.padding).toBe(0)
    expect(result.settings.maxRelayouts).toBe(0)
  })

  it('clamps maxAttemptsPerWord to at least one', () => {
    const result = computeWordCloudLayout(baselineWords, {
      width: 500,
      height: 300,
      maxAttemptsPerWord: 0,
      deterministic: true,
      seed: '42',
    })

    expect(result.settings.maxAttemptsPerWord).toBe(1)
  })
})
