export type ResponsePoints = {
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}

export type PointCorrectionInstruction = {
  appliedCorrectionId: number
  pointCorrection: {
    basePoints: boolean | null
    correctnessPoints: boolean | null
    bonusPoints: boolean | null
  }
}

export type ReplayedPointCorrection = {
  appliedCorrectionId: number
  awardedBasePoints: number
  awardedCorrectnessPoints: number
  awardedBonusPoints: number
  deductedBasePoints: number
  deductedCorrectnessPoints: number
  deductedBonusPoints: number
}

export function getSampleSolutionAvailability({
  type,
  cachedFlag,
  solutions,
}: {
  type?: string
  cachedFlag?: string
  solutions?: string
}) {
  if (typeof cachedFlag !== 'undefined') return cachedFlag === 'true'
  if (!solutions) return false

  if (type === 'SELECTION') {
    try {
      const parsedSolutions = JSON.parse(solutions)
      return Array.isArray(parsedSolutions) && parsedSolutions.length > 0
    } catch {
      return false
    }
  }

  return true
}

export function getResponseState(
  response: { correctionOnly: boolean; correlationId: string | null } | null,
  correlationId: string
): 'create' | 'duplicate' | 'materialize' | 'retry' {
  if (!response) return 'create'
  if (response.correctionOnly) {
    return response.correlationId === null ||
      response.correlationId === correlationId
      ? 'materialize'
      : 'duplicate'
  }
  return response.correlationId === correlationId ? 'retry' : 'duplicate'
}

function applyCorrection(
  current: number,
  correction: boolean | null,
  available: number
) {
  if (correction === true) return available
  if (correction === false) return 0
  return current
}

function getDelta(previous: number, current: number) {
  const delta = current - previous
  return {
    awarded: Math.max(delta, 0),
    deducted: Math.max(-delta, 0),
  }
}

export function replayPointCorrections({
  rawPoints,
  availablePoints,
  corrections,
}: {
  rawPoints: ResponsePoints
  availablePoints: ResponsePoints
  corrections: readonly PointCorrectionInstruction[]
}) {
  // Applied-correction IDs reflect the order in which each response acquired
  // its lock and was updated, which is the only stable order under overlap.
  const orderedCorrections = [...corrections].sort(
    (left, right) => left.appliedCorrectionId - right.appliedCorrectionId
  )

  let currentPoints = { ...rawPoints }
  const appliedCorrections: ReplayedPointCorrection[] = []

  orderedCorrections.forEach((correction) => {
    const previousPoints = currentPoints
    currentPoints = {
      basePoints: applyCorrection(
        previousPoints.basePoints,
        correction.pointCorrection.basePoints,
        availablePoints.basePoints
      ),
      correctnessPoints: applyCorrection(
        previousPoints.correctnessPoints,
        correction.pointCorrection.correctnessPoints,
        availablePoints.correctnessPoints
      ),
      bonusPoints: applyCorrection(
        previousPoints.bonusPoints,
        correction.pointCorrection.bonusPoints,
        availablePoints.bonusPoints
      ),
    }

    const baseDelta = getDelta(
      previousPoints.basePoints,
      currentPoints.basePoints
    )
    const correctnessDelta = getDelta(
      previousPoints.correctnessPoints,
      currentPoints.correctnessPoints
    )
    const bonusDelta = getDelta(
      previousPoints.bonusPoints,
      currentPoints.bonusPoints
    )

    appliedCorrections.push({
      appliedCorrectionId: correction.appliedCorrectionId,
      awardedBasePoints: baseDelta.awarded,
      awardedCorrectnessPoints: correctnessDelta.awarded,
      awardedBonusPoints: bonusDelta.awarded,
      deductedBasePoints: baseDelta.deducted,
      deductedCorrectnessPoints: correctnessDelta.deducted,
      deductedBonusPoints: bonusDelta.deducted,
    })
  })

  return { points: currentPoints, appliedCorrections }
}
