import {
  type AdaptiveResultLevelBand,
  prepareAdaptiveResultLevelBands,
} from '@klicker-uzh/adaptive-contract'

/** Display coordinates only. The statistical scale and estimates stay unchanged. */
export function createEqualLevelScale(levelBands: AdaptiveResultLevelBand[]) {
  const source = prepareAdaptiveResultLevelBands(levelBands)
  const bands = source.map((band, index) => ({
    ...band,
    startPosition: index / source.length,
    endPosition: (index + 1) / source.length,
  }))
  const project = (position: number) => {
    if (!Number.isFinite(position) || source.length === 0) return position
    if (position <= source[0]!.startPosition) return 0
    for (const [index, band] of source.entries()) {
      if (position <= band.endPosition) {
        const fraction = Math.max(
          0,
          (position - band.startPosition) /
            (band.endPosition - band.startPosition)
        )
        return (index + fraction) / source.length
      }
    }
    return 1
  }
  return { bands, project }
}
