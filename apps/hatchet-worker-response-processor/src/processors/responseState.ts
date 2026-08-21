export type ResponsePoints = {
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}

export type PointCorrectionInstruction = {
  appliedCorrectionId: number
  pointCorrection: {
    id: number
    createdAt: Date
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

export function getResponseState(
  response: { correctionOnly: boolean } | null
): 'create' | 'duplicate' | 'materialize' {
  if (!response) return 'create'
  return response.correctionOnly ? 'materialize' : 'duplicate'
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
  const orderedCorrections = [...corrections].sort((left, right) => {
    const createdAtDelta =
      left.pointCorrection.createdAt.getTime() -
      right.pointCorrection.createdAt.getTime()

    return createdAtDelta || left.pointCorrection.id - right.pointCorrection.id
  })

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
