import type { AdaptiveLevel } from './types'

export const ADAPTIVE_LEVEL_COLORS = [
  {
    key: 'novice',
    bg: 'bg-uzh-grey-20',
    text: 'text-slate-700',
    fill: '#a3adb7',
    soft: '#edeff1',
  },
  {
    key: 'developing',
    bg: 'bg-primary-20',
    text: 'text-primary-100',
    fill: '#667ec9',
    soft: '#ccd4ed',
  },
  {
    key: 'proficient',
    bg: 'bg-primary-20',
    text: 'text-primary-100',
    fill: '#0028a5',
    soft: '#ccd4ed',
  },
  {
    key: 'advanced',
    bg: 'bg-uzh-turqoise-20',
    text: 'text-uzh-turqoise-100',
    fill: '#0b82a0',
    soft: '#cfe8ec',
  },
  {
    key: 'expert',
    bg: 'bg-uzh-darkgreen-20',
    text: 'text-uzh-darkgreen-100',
    fill: '#2a7f62',
    soft: '#d5e7e1',
  },
] as const

export const ADAPTIVE_COMPETENCE_COLORS = [
  '#0028a5',
  '#dc6027',
  '#0b82a0',
  '#2a7f62',
  '#667ec9',
  '#91c34a',
] as const

export function getLevelColor(label?: string | null, index = 2) {
  const normalized = (label ?? '').toLowerCase()
  const explicitIndex = ADAPTIVE_LEVEL_COLORS.findIndex(({ key }) =>
    normalized.includes(key)
  )
  const fallbackIndex =
    normalized === 'n'
      ? 0
      : normalized === 'd'
        ? 1
        : normalized === 'p'
          ? 2
          : normalized === 'a'
            ? 3
            : normalized === 'e'
              ? 4
              : index

  const color =
    ADAPTIVE_LEVEL_COLORS[
      explicitIndex >= 0
        ? explicitIndex
        : Math.min(ADAPTIVE_LEVEL_COLORS.length - 1, Math.max(0, fallbackIndex))
    ]

  return color ?? ADAPTIVE_LEVEL_COLORS[2]!
}

export function mapLevelsToBands(
  levels: AdaptiveLevel[],
  min: number,
  max: number
) {
  const ordered = [...levels].sort((a, b) => a.order - b.order)
  const span = max - min

  return ordered.map((level, index) => {
    const start = min + (span * index) / ordered.length
    const end = min + (span * (index + 1)) / ordered.length

    return {
      ...level,
      minTheta: start,
      maxTheta: end,
      color: getLevelColor(level.label, index),
    }
  })
}

export function thetaToPercent(theta: number, min: number, max: number) {
  if (max <= min) return 50
  return Math.min(100, Math.max(0, ((theta - min) / (max - min)) * 100))
}

export function formatTheta(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function shortLevelLabel(label?: string | null) {
  if (!label) return '-'
  return label.length <= 2 ? label : label.slice(0, 1).toUpperCase()
}
