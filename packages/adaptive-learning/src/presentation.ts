export type AdaptiveResultLevelBand = {
  label: string
  order: number
  startPosition: number
  endPosition: number
}

export type AdaptiveResultTrajectoryPoint = {
  order: number
  position: number
  lowerPosition: number
  upperPosition: number
  levelLabel?: string | null
}

export type AdaptiveResultOverallPoint = {
  answeredQuestions: number
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
  levelLabel?: string | null
}

export type AdaptiveResultChartPoint = AdaptiveResultTrajectoryPoint & {
  interval: [number, number]
  isEndpoint: boolean
}

export type AdaptiveTrajectoryPointDescription = {
  question: number
  levelLabel: string | null
  lowerLevelLabel: string | null
  upperLevelLabel: string | null
}

export function prepareAdaptiveResultLevelBands(
  bands: AdaptiveResultLevelBand[]
): AdaptiveResultLevelBand[] {
  return bands
    .filter(
      (band) =>
        Number.isFinite(band.startPosition) && Number.isFinite(band.endPosition)
    )
    .map((band) => ({
      ...band,
      startPosition: clampNormalizedPosition(
        Math.min(band.startPosition, band.endPosition)
      ),
      endPosition: clampNormalizedPosition(
        Math.max(band.startPosition, band.endPosition)
      ),
    }))
    .filter((band) => band.endPosition > band.startPosition)
    .sort((a, b) => a.order - b.order || a.startPosition - b.startPosition)
}

export function prepareAdaptiveResultTrajectory({
  trajectory,
  overall,
}: {
  trajectory: AdaptiveResultTrajectoryPoint[]
  overall: AdaptiveResultOverallPoint
}): AdaptiveResultChartPoint[] {
  const byOrder = new Map<number, AdaptiveResultTrajectoryPoint>()
  for (const point of trajectory) {
    if (
      !Number.isInteger(point.order) ||
      point.order < 1 ||
      !isFiniteTrajectoryPoint(point)
    ) {
      continue
    }
    byOrder.set(point.order, point)
  }

  const points = [...byOrder.values()]
    .sort((a, b) => a.order - b.order)
    .map(normalizeTrajectoryPoint)
  const overallPoint = normalizeOverallPoint(overall)

  if (points.length === 0) {
    return overallPoint ? [{ ...overallPoint, isEndpoint: true }] : []
  }

  if (overallPoint) {
    return [
      ...points
        .filter((point) => point.order < overallPoint.order)
        .map((point) => ({ ...point, isEndpoint: false })),
      { ...overallPoint, isEndpoint: true },
    ]
  }

  const lastIndex = points.length - 1
  points[lastIndex] = { ...points[lastIndex]!, isEndpoint: true }
  return points
}

export function findAdaptiveLevelBandLabel(
  position: number,
  bands: AdaptiveResultLevelBand[]
): string | null {
  if (!Number.isFinite(position)) return null
  const normalizedBands = prepareAdaptiveResultLevelBands(bands)
  const normalizedPosition = clampNormalizedPosition(position)

  return (
    normalizedBands.find(
      (band, index) =>
        normalizedPosition >= band.startPosition &&
        (normalizedPosition < band.endPosition ||
          (index === normalizedBands.length - 1 &&
            normalizedPosition <= band.endPosition))
    )?.label ?? null
  )
}

export function describeAdaptiveTrajectoryPoint(
  point: AdaptiveResultChartPoint,
  bands: AdaptiveResultLevelBand[]
): AdaptiveTrajectoryPointDescription {
  return {
    question: point.order,
    levelLabel: point.levelLabel ?? null,
    lowerLevelLabel: findAdaptiveLevelBandLabel(point.lowerPosition, bands),
    upperLevelLabel: findAdaptiveLevelBandLabel(point.upperPosition, bands),
  }
}

export function summarizeAdaptiveTrajectory(
  points: AdaptiveResultChartPoint[]
) {
  const classified = points.filter((point) => point.levelLabel)
  return {
    questionCount: points.at(-1)?.order ?? 0,
    firstLevelLabel: classified[0]?.levelLabel ?? null,
    finalLevelLabel: points.at(-1)?.levelLabel ?? null,
    classifiedPointCount: classified.length,
  }
}

export function clampNormalizedPosition(position: number) {
  return Math.min(1, Math.max(0, position))
}

function isFiniteTrajectoryPoint(point: AdaptiveResultTrajectoryPoint) {
  return (
    Number.isFinite(point.position) &&
    Number.isFinite(point.lowerPosition) &&
    Number.isFinite(point.upperPosition)
  )
}

function normalizeTrajectoryPoint(
  point: AdaptiveResultTrajectoryPoint
): AdaptiveResultChartPoint {
  const lowerPosition = clampNormalizedPosition(
    Math.min(point.lowerPosition, point.upperPosition)
  )
  const upperPosition = clampNormalizedPosition(
    Math.max(point.lowerPosition, point.upperPosition)
  )
  return {
    ...point,
    position: clampNormalizedPosition(point.position),
    lowerPosition,
    upperPosition,
    interval: [lowerPosition, upperPosition],
    levelLabel: point.levelLabel ?? null,
    isEndpoint: false,
  }
}

function normalizeOverallPoint(
  overall: AdaptiveResultOverallPoint
): AdaptiveResultChartPoint | null {
  if (
    !Number.isInteger(overall.answeredQuestions) ||
    overall.answeredQuestions < 1 ||
    typeof overall.position !== 'number' ||
    typeof overall.lowerPosition !== 'number' ||
    typeof overall.upperPosition !== 'number' ||
    !Number.isFinite(overall.position) ||
    !Number.isFinite(overall.lowerPosition) ||
    !Number.isFinite(overall.upperPosition)
  ) {
    return null
  }

  return normalizeTrajectoryPoint({
    order: overall.answeredQuestions,
    position: overall.position,
    lowerPosition: overall.lowerPosition,
    upperPosition: overall.upperPosition,
    levelLabel: overall.levelLabel ?? null,
  })
}
