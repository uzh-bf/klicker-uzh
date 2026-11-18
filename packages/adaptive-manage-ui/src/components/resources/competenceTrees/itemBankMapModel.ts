export type ItemBankCalibrationStatus =
  | 'PROVISIONAL'
  | 'PILOT'
  | 'CALIBRATED'
  | 'FLAGGED'
  | 'RETIRED'
  | 'MISSING'

export interface ItemBankScaleLevel {
  order: number
  label: string
  lowerBound?: number | null
  itemDifficultyPrior: number
  sourceLevelId?: number | null
}

export interface ItemBankAssignment {
  id: number
  elementId: number
  elementName: string
  elementType: string
  elementVersion: number
  levelId: number
  enabled: boolean
}

export interface ItemBankCalibration {
  assignmentId: number
  elementVersion: number
  version: number
  status: Exclude<ItemBankCalibrationStatus, 'MISSING'>
  discrimination: number
  difficulty: number
  guessing: number
}

export interface ItemBankMapItem {
  assignmentId: number
  elementId: number
  elementName: string
  elementType: string
  elementVersion: number
  enabled: boolean
  levelLabel: string
  position: number
  positionSource: 'CALIBRATED' | 'EXPECTED'
  status: ItemBankCalibrationStatus
}

export interface ItemBankMapCut {
  levelLabel: string
  position: number
  hasNearbyCalibratedItems: boolean
}

export interface ItemBankInformationPoint {
  position: number
  information: number
}

export interface ItemBankMapData {
  domain: [number, number]
  items: ItemBankMapItem[]
  cuts: ItemBankMapCut[]
  information: ItemBankInformationPoint[]
  counts: Record<ItemBankCalibrationStatus, number>
  missingCutNeighborhoods: ItemBankMapCut[]
}

export function filterItemBankItems(
  items: readonly ItemBankMapItem[],
  query: string
): ItemBankMapItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return [...items]

  return items.filter((item) =>
    [item.elementName, item.elementType, item.levelLabel, item.status].some(
      (value) => value.toLocaleLowerCase().includes(normalizedQuery)
    )
  )
}

const CALIBRATION_STATUSES: ItemBankCalibrationStatus[] = [
  'PROVISIONAL',
  'PILOT',
  'CALIBRATED',
  'FLAGGED',
  'RETIRED',
  'MISSING',
]

export function buildItemBankMap({
  assignments,
  calibrations,
  levels,
  gridMin,
  gridMax,
  gridStep,
  cutNeighborhood = 0.75,
}: {
  assignments: ItemBankAssignment[]
  calibrations: ItemBankCalibration[]
  levels: ItemBankScaleLevel[]
  gridMin: number
  gridMax: number
  gridStep: number
  cutNeighborhood?: number
}): ItemBankMapData {
  const orderedLevels = [...levels].sort(
    (left, right) => left.order - right.order
  )
  const levelBySourceId = new Map(
    orderedLevels.flatMap((level) =>
      typeof level.sourceLevelId === 'number'
        ? ([[level.sourceLevelId, level]] as const)
        : []
    )
  )
  const latestCalibrationByAssignment = selectLatestCalibrations(calibrations)

  const items = assignments.map((assignment) => {
    const level = levelBySourceId.get(assignment.levelId)
    const calibration = latestCalibrationByAssignment.get(assignment.id)
    const calibrationMatchesElement =
      calibration?.elementVersion === assignment.elementVersion

    return {
      assignmentId: assignment.id,
      elementId: assignment.elementId,
      elementName: assignment.elementName,
      elementType: assignment.elementType,
      elementVersion: assignment.elementVersion,
      enabled: assignment.enabled,
      levelLabel: level?.label ?? '',
      position: calibrationMatchesElement
        ? calibration.difficulty
        : (level?.itemDifficultyPrior ?? 0),
      positionSource: calibrationMatchesElement
        ? ('CALIBRATED' as const)
        : ('EXPECTED' as const),
      status: calibrationMatchesElement
        ? calibration.status
        : ('MISSING' as const),
    }
  })

  const usableCalibrations = items.flatMap((item) => {
    const calibration = latestCalibrationByAssignment.get(item.assignmentId)
    return item.enabled &&
      item.positionSource === 'CALIBRATED' &&
      calibration &&
      calibration.status === 'CALIBRATED'
      ? [calibration]
      : []
  })
  const cuts = orderedLevels.flatMap((level) =>
    typeof level.lowerBound === 'number'
      ? [
          {
            levelLabel: level.label,
            position: level.lowerBound,
            hasNearbyCalibratedItems: usableCalibrations.some(
              (calibration) =>
                Math.abs(calibration.difficulty - level.lowerBound!) <=
                cutNeighborhood
            ),
          },
        ]
      : []
  )

  return {
    domain: normalizeDomain(gridMin, gridMax),
    items,
    cuts,
    information: sampleInformation({
      calibrations: usableCalibrations,
      gridMin,
      gridMax,
      gridStep,
    }),
    counts: Object.fromEntries(
      CALIBRATION_STATUSES.map((status) => [
        status,
        items.filter((item) => item.status === status).length,
      ])
    ) as Record<ItemBankCalibrationStatus, number>,
    missingCutNeighborhoods: cuts.filter(
      (cut) => !cut.hasNearbyCalibratedItems
    ),
  }
}

function selectLatestCalibrations(calibrations: ItemBankCalibration[]) {
  const latest = new Map<number, ItemBankCalibration>()
  for (const calibration of calibrations) {
    const current = latest.get(calibration.assignmentId)
    if (!current || calibration.version > current.version) {
      latest.set(calibration.assignmentId, calibration)
    }
  }
  return latest
}

function normalizeDomain(gridMin: number, gridMax: number): [number, number] {
  if (
    Number.isFinite(gridMin) &&
    Number.isFinite(gridMax) &&
    gridMin < gridMax
  ) {
    return [gridMin, gridMax]
  }
  return [-6, 6]
}

function sampleInformation({
  calibrations,
  gridMin,
  gridMax,
  gridStep,
}: {
  calibrations: ItemBankCalibration[]
  gridMin: number
  gridMax: number
  gridStep: number
}): ItemBankInformationPoint[] {
  const [min, max] = normalizeDomain(gridMin, gridMax)
  const step = Number.isFinite(gridStep) && gridStep > 0 ? gridStep : 0.1
  const sampleStep = Math.max(step, (max - min) / 120)
  const points: ItemBankInformationPoint[] = []

  for (
    let position = min;
    position <= max + sampleStep / 2;
    position += sampleStep
  ) {
    points.push({
      position: Number(position.toFixed(6)),
      information: calibrations.reduce(
        (sum, calibration) => sum + itemInformation(position, calibration),
        0
      ),
    })
  }

  return points
}

function itemInformation(
  position: number,
  calibration: ItemBankCalibration
): number {
  const { discrimination: a, difficulty: b, guessing: c } = calibration
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    a <= 0 ||
    c < 0 ||
    c >= 1
  ) {
    return 0
  }

  const logistic = 1 / (1 + Math.exp(-a * (position - b)))
  const probability = c + (1 - c) * logistic
  if (probability <= 0 || probability >= 1) return 0

  const adjustedProbability = (probability - c) / (1 - c)
  return (
    a *
    a *
    adjustedProbability *
    adjustedProbability *
    ((1 - probability) / probability)
  )
}
