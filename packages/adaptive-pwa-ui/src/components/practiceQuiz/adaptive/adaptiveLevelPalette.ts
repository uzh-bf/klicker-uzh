/**
 * Ordered, non-repeating background colors for ordinal level bands.
 *
 * Levels are ordinal, so a small categorical palette that cycles (the old
 * five-color list) makes distant levels look identical once a scale has more
 * than five levels. This helper derives one color per level instead:
 *
 * - Grouped scales: when level labels share main-level prefixes
 *   (A2.1/A2.2/A2.3 -> A2, B1.1 -> B1, or A1/A2 -> A), each main level gets
 *   its own hue family along an ordered cool-to-warm hue ramp, and its
 *   sublevels get lightness steps within that family (lighter = lower).
 *   Labels without a prefix (e.g. a lowest "Under A2" level) get a neutral
 *   gray so that they read as outside the main-level system.
 * - Ungrouped scales: one continuous cool-to-warm ramp with decreasing
 *   lightness across all levels.
 *
 * All colors are light tints (relative luminance well above the marker
 * color), so the dark current-estimate marker and the uncertainty overlay
 * remain clearly visible on every band. Band boundaries are additionally
 * drawn as separators by the components, so adjacent bands never rely on a
 * color difference alone.
 */

const LABEL_PATTERN = /^([A-Za-z]{1,3}\d{0,2})[.\-_]?(\d{1,2})$/

// Colors are built in OKLCH so that lightness steps are perceptually even
// across hues (HSL yellow is much brighter than HSL blue at equal lightness).
// Ordered hue ramp (OKLCH degrees): blue -> teal -> green -> yellow -> orange
// -> rose, read as low -> high.
const HUE_START = 255
const HUE_END = 5
const CHROMA = 0.055
const LIGHTNESS_MAX = 0.955
const LIGHTNESS_MIN = 0.86
const NEUTRAL_CHROMA = 0.008
const NEUTRAL_HUE = 255

export const ADAPTIVE_LEVEL_MARKER_COLOR = '#00589c'

type ParsedLabel = { group: string; sub: number } | null

function parseLabel(label: string): ParsedLabel {
  const match = LABEL_PATTERN.exec(label.trim())
  if (!match) return null
  return { group: match[1]!, sub: Number(match[2]) }
}

/**
 * Returns contiguous main-level groups when at least two prefixed groups
 * exist, every group is contiguous in level order, and at most the first and
 * last levels are unprefixed. Otherwise null (use the continuous ramp).
 */
function resolveGroups(labels: readonly string[]) {
  const parsed = labels.map(parseLabel)
  const groups: string[] = []
  for (const [index, entry] of parsed.entries()) {
    if (!entry) {
      if (index !== 0 && index !== labels.length - 1) return null
      continue
    }
    const last = groups.at(-1)
    if (last === entry.group) continue
    if (groups.includes(entry.group)) return null
    groups.push(entry.group)
  }
  if (groups.length < 2) return null
  return { parsed, groups }
}

function lightnessStep(index: number, count: number) {
  if (count <= 1) return (LIGHTNESS_MAX + LIGHTNESS_MIN) / 2
  return LIGHTNESS_MAX - ((LIGHTNESS_MAX - LIGHTNESS_MIN) * index) / (count - 1)
}

function hueAt(fraction: number) {
  return HUE_START + (HUE_END - HUE_START) * fraction
}

export type AdaptiveLevelColorSpec = {
  lightness: number
  chroma: number
  hue: number
  /** Main-level group key, or null for the ungrouped ramp / neutral levels. */
  group: string | null
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
  const grouped = resolveGroups(labels)

  if (!grouped) {
    return labels.map((_, index) => ({
      lightness: lightnessStep(index, count),
      chroma: CHROMA,
      hue: hueAt(count === 1 ? 0 : index / (count - 1)),
      group: null,
    }))
  }

  const { parsed, groups } = grouped
  const membersByGroup = new Map<string, number[]>()
  for (const [index, entry] of parsed.entries()) {
    if (!entry) continue
    const members = membersByGroup.get(entry.group) ?? []
    members.push(index)
    membersByGroup.set(entry.group, members)
  }
  return labels.map((_, index) => {
    const entry = parsed[index]
    if (!entry) {
      // Unprefixed lowest/highest level ("Under A2", "Above C2").
      return {
        lightness: index === 0 ? LIGHTNESS_MAX - 0.02 : LIGHTNESS_MIN,
        chroma: NEUTRAL_CHROMA,
        hue: NEUTRAL_HUE,
        group: null,
      }
    }
    const groupIndex = groups.indexOf(entry.group)
    const members = membersByGroup.get(entry.group)!
    return {
      lightness: lightnessStep(members.indexOf(index), members.length),
      chroma: CHROMA,
      hue: hueAt(groupIndex / (groups.length - 1)),
      group: entry.group,
    }
  })
}

/** Colors keyed by band order, for components that receive level bands. */
export function getAdaptiveLevelBandColors(
  bands: ReadonlyArray<{ label: string; order: number }>
): string[] {
  const ordered = bands
    .map((band, index) => ({ band, index }))
    .sort((a, b) => a.band.order - b.band.order || a.index - b.index)
  const colors = getAdaptiveLevelColors(ordered.map(({ band }) => band.label))
  const result = new Array<string>(bands.length)
  for (const [position, { index }] of ordered.entries()) {
    result[index] = colors[position]!
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
