/**
 * Ordered, non-repeating background colors for ordinal level bands.
 *
 * Levels are ordinal, so a small categorical palette that cycles (the old
 * five-color list) makes distant levels look identical once a scale has more
 * than five levels. This helper derives one color per level from a single,
 * muted hue close to the UZH primary blue (--theme-color-primary #0028a5):
 * a sequential ramp from light (lowest level) to darker (highest level).
 *
 * - Grouped scales: when level labels share main-level prefixes
 *   (A2.1/A2.2/A2.3 -> A2, B1.1 -> B1, or A1/A2 -> A), the hue stays the same
 *   and the grouping is shown by a larger lightness step between main levels
 *   than between sublevels (plus a wider separator, see
 *   getAdaptiveLevelGroupEnds).
 * - Labels outside the prefix system at the lowest/highest end (e.g.
 *   "Under A2") are neutral gray.
 * - Ungrouped scales: the same single-hue ramp with even steps.
 *
 * All tints keep at least 4.5:1 contrast against the navy estimate marker,
 * and components draw white separators between bands, so adjacent bands
 * never rely on a color difference alone.
 */

const LABEL_PATTERN = /^([A-Za-z]{1,3}\d{0,2})[.\-_]?(\d{1,2})$/

// OKLCH keeps lightness steps perceptually even.
const HUE = 262
const LIGHTNESS_MAX = 0.965
const LIGHTNESS_MIN = 0.775
const CHROMA_MIN = 0.022
const CHROMA_MAX = 0.06
// A step between main levels counts as this many sublevel steps.
const GROUP_GAP = 1.75
const NEUTRAL_CHROMA = 0.004
const NEUTRAL_HUE = 250

/** UZH primary blue; dark enough for >= 4.5:1 against every band. */
export const ADAPTIVE_LEVEL_MARKER_COLOR = '#0028a5'

/**
 * Muted, mutually distinct marker colors for competences (not levels) in the
 * testing chart; all stay readable (>= 4.5:1) on every level band.
 */
export const ADAPTIVE_COMPETENCE_MARKER_COLORS = [
  '#1e3a8a',
  '#7c2d12',
  '#0f3f22',
  '#581c87',
  '#7f1230',
  '#134e4a',
]

type ParsedLabel = { group: string; sub: number } | null

function parseLabel(label: string): ParsedLabel {
  const match = LABEL_PATTERN.exec(label.trim())
  if (!match) return null
  return { group: match[1]!, sub: Number(match[2]) }
}

/**
 * Returns the parsed labels when at least two prefixed groups exist, every
 * group is contiguous in level order, and at most the first and last levels
 * are unprefixed. Otherwise null (use the even ramp).
 */
function resolveGroups(labels: readonly string[]) {
  const parsed = labels.map(parseLabel)
  const groups: string[] = []
  for (const [index, entry] of parsed.entries()) {
    if (!entry) {
      if (index !== 0 && index !== labels.length - 1) return null
      continue
    }
    if (groups.at(-1) === entry.group) continue
    if (groups.includes(entry.group)) return null
    groups.push(entry.group)
  }
  if (groups.length < 2) return null
  return parsed
}

export type AdaptiveLevelColorSpec = {
  lightness: number
  chroma: number
  hue: number
  /** Main-level group key, or null for the ungrouped ramp / neutral levels. */
  group: string | null
  /** True when the next level belongs to another main level (or is neutral). */
  groupEnd: boolean
}

export function getAdaptiveLevelColors(labels: readonly string[]): string[] {
  return getAdaptiveLevelColorSpecs(labels).map(({ lightness, chroma, hue }) =>
    oklchToHex(lightness, chroma, hue)
  )
}

export function getAdaptiveLevelColorSpecs(
  labels: readonly string[]
): AdaptiveLevelColorSpec[] {
  const count = labels.length
  if (count === 0) return []
  const parsed = resolveGroups(labels)

  // Ramp coordinate per ramp level: sublevel steps count 1, main-level steps
  // GROUP_GAP. Neutral (unprefixed) outside levels are not on the ramp.
  const rampIndices: number[] = []
  const coordinates = new Map<number, number>()
  let coordinate = 0
  for (let index = 0; index < count; index += 1) {
    const entry = parsed?.[index]
    if (parsed && !entry) continue
    const previous = rampIndices.at(-1)
    if (previous !== undefined) {
      coordinate +=
        parsed && parsed[previous]!.group !== entry!.group ? GROUP_GAP : 1
    }
    rampIndices.push(index)
    coordinates.set(index, coordinate)
  }
  const span = coordinate

  return labels.map((_, index) => {
    const entry = parsed?.[index] ?? null
    const next = index + 1 < count ? (parsed?.[index + 1] ?? null) : undefined
    const groupEnd =
      parsed !== null &&
      next !== undefined &&
      (entry === null || next === null || next.group !== entry.group)
    if (!coordinates.has(index)) {
      // Unprefixed lowest/highest level ("Under A2", "Above C2").
      return {
        lightness: index === 0 ? LIGHTNESS_MAX - 0.035 : LIGHTNESS_MIN - 0.02,
        chroma: NEUTRAL_CHROMA,
        hue: NEUTRAL_HUE,
        group: null,
        groupEnd,
      }
    }
    const fraction = span === 0 ? 0.5 : coordinates.get(index)! / span
    return {
      lightness: LIGHTNESS_MAX - (LIGHTNESS_MAX - LIGHTNESS_MIN) * fraction,
      chroma: CHROMA_MIN + (CHROMA_MAX - CHROMA_MIN) * fraction,
      hue: HUE,
      group: entry?.group ?? null,
      groupEnd,
    }
  })
}

function orderBands(bands: ReadonlyArray<{ label: string; order: number }>) {
  return bands
    .map((band, index) => ({ band, index }))
    .sort((a, b) => a.band.order - b.band.order || a.index - b.index)
}

/** Colors keyed by band order, for components that receive level bands. */
export function getAdaptiveLevelBandColors(
  bands: ReadonlyArray<{ label: string; order: number }>
): string[] {
  const ordered = orderBands(bands)
  const colors = getAdaptiveLevelColors(ordered.map(({ band }) => band.label))
  const result = new Array<string>(bands.length)
  for (const [position, { index }] of ordered.entries()) {
    result[index] = colors[position]!
  }
  return result
}

/**
 * Per band (input order): true when the band is the last of its main-level
 * group, so components can draw a wider separator after it.
 */
export function getAdaptiveLevelGroupEnds(
  bands: ReadonlyArray<{ label: string; order: number }>
): boolean[] {
  const ordered = orderBands(bands)
  const specs = getAdaptiveLevelColorSpecs(
    ordered.map(({ band }) => band.label)
  )
  const result = new Array<boolean>(bands.length)
  for (const [position, { index }] of ordered.entries()) {
    result[index] = specs[position]!.groupEnd
  }
  return result
}

/** OKLCH (L 0..1, chroma, hue in degrees) to an sRGB hex color. */
export function oklchToHex(lightness: number, chroma: number, hue: number) {
  const radians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return `#${linear
    .map((value) => {
      const clamped = Math.min(1, Math.max(0, value))
      const encoded =
        clamped <= 0.0031308
          ? 12.92 * clamped
          : 1.055 * clamped ** (1 / 2.4) - 0.055
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, '0')
    })
    .join('')}`
}

export function relativeLuminance(hex: string) {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastRatio(left: string, right: string) {
  const [high, low] = [relativeLuminance(left), relativeLuminance(right)].sort(
    (a, b) => b - a
  )
  return (high! + 0.05) / (low! + 0.05)
}
