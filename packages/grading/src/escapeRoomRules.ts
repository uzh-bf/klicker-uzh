// Scoring rules shared by every Escape Room mode. The GraphQL grading
// adapters, the progress service and the Response API call these functions so
// that the same answer sequence costs the same time in every mode.

export type EscapeRoomStageOutcome =
  | 'SOLVED'
  | 'REVEALED'
  | 'SKIPPED'
  | 'BONUS_CORRECT'
  | 'BONUS_WRONG'

export interface EscapeRoomRules {
  // Fallback penalty for a hint without its own or an indexed penalty.
  hintPenalty: number
  // Default penalty per hint position (first hint, second hint, ...).
  hintPenalties: readonly number[]
  wrongAnswerPenalty: number
  // Wrong answers on one stage before its solution is revealed; null = never.
  maxWrongAttempts: number | null
  revealPenalty: number
  // Penalty for voluntarily skipping a stage; null = skipping is disabled.
  skipPenalty: number | null
  // Time credit for a correct bonus answer; null = no bonus stage.
  bonusSeconds: number | null
}

// The lecturer-tested classroom values, offered as a preset in the editor.
export const ESCAPE_ROOM_CLASSROOM_PRESET = {
  timeLimitMinutes: 45,
  hintPenalty: 120,
  hintPenalties: [120, 240],
  wrongAnswerPenalty: 30,
  maxWrongAttempts: 5,
  revealPenalty: 480,
  skipPenalty: 600,
  bonusSeconds: 180,
} as const

export function getEscapeRoomHintPenalty(
  rules: Pick<EscapeRoomRules, 'hintPenalty' | 'hintPenalties'>,
  hintIndex: number,
  ownPenalty?: number | null
) {
  if (typeof ownPenalty === 'number') return ownPenalty
  return rules.hintPenalties[hintIndex] ?? rules.hintPenalty
}

export interface EscapeRoomWrongAnswerResult {
  wrongAttempts: number
  penaltySeconds: number
  revealed: boolean
  // Remaining wrong answers before the reveal; null when unlimited.
  attemptsLeft: number | null
}

export function applyEscapeRoomWrongAnswer(
  rules: Pick<
    EscapeRoomRules,
    'wrongAnswerPenalty' | 'maxWrongAttempts' | 'revealPenalty'
  >,
  previousWrongAttempts: number
): EscapeRoomWrongAnswerResult {
  const wrongAttempts = previousWrongAttempts + 1
  const revealed =
    rules.maxWrongAttempts !== null && wrongAttempts >= rules.maxWrongAttempts
  return {
    wrongAttempts,
    penaltySeconds:
      rules.wrongAnswerPenalty + (revealed ? rules.revealPenalty : 0),
    revealed,
    attemptsLeft:
      rules.maxWrongAttempts === null
        ? null
        : Math.max(rules.maxWrongAttempts - wrongAttempts, 0),
  }
}

export function getEscapeRoomAttemptsLeft(
  rules: Pick<EscapeRoomRules, 'maxWrongAttempts'>,
  wrongAttempts: number
) {
  return rules.maxWrongAttempts === null
    ? null
    : Math.max(rules.maxWrongAttempts - wrongAttempts, 0)
}

// Returns the skip penalty, or null when the rules do not allow skipping.
export function getEscapeRoomSkipPenalty(
  rules: Pick<EscapeRoomRules, 'skipPenalty'>
) {
  return rules.skipPenalty
}

export function isEscapeRoomBonusStage(
  rules: Pick<EscapeRoomRules, 'bonusSeconds'>,
  stageIndex: number,
  stageCount: number
) {
  return (
    rules.bonusSeconds !== null &&
    stageCount > 1 &&
    stageIndex === stageCount - 1
  )
}

export function getEscapeRoomBonusCredit(
  rules: Pick<EscapeRoomRules, 'bonusSeconds'>,
  correct: boolean
) {
  return correct ? (rules.bonusSeconds ?? 0) : 0
}

export interface EscapeRoomScoredStage {
  outcome: EscapeRoomStageOutcome
  at: Date | string
  creditSeconds?: number | null
}

export interface EscapeRoomAttemptScore {
  solvedStages: number
  revealedStages: number
  skippedStages: number
  bonusCorrect: boolean | null
  // Time from start to the last non-bonus stage outcome, plus penalties,
  // minus the bonus credit; null before any stage has an outcome.
  rankedSeconds: number | null
}

export function scoreEscapeRoomAttempt({
  startedAt,
  penaltySeconds,
  stages,
}: {
  startedAt: Date | string
  penaltySeconds: number
  stages: readonly EscapeRoomScoredStage[]
}): EscapeRoomAttemptScore {
  let solvedStages = 0
  let revealedStages = 0
  let skippedStages = 0
  let bonusCorrect: boolean | null = null
  let creditSeconds = 0
  let lastAt: number | null = null

  for (const stage of stages) {
    if (stage.outcome === 'BONUS_CORRECT' || stage.outcome === 'BONUS_WRONG') {
      bonusCorrect = stage.outcome === 'BONUS_CORRECT'
      creditSeconds += stage.creditSeconds ?? 0
      continue
    }
    if (stage.outcome === 'SOLVED') solvedStages++
    if (stage.outcome === 'REVEALED') revealedStages++
    if (stage.outcome === 'SKIPPED') skippedStages++
    const at = new Date(stage.at).getTime()
    lastAt = lastAt === null ? at : Math.max(lastAt, at)
  }

  return {
    solvedStages,
    revealedStages,
    skippedStages,
    bonusCorrect,
    rankedSeconds:
      lastAt === null
        ? null
        : Math.max(
            Math.round((lastAt - new Date(startedAt).getTime()) / 1000),
            0
          ) +
          penaltySeconds -
          creditSeconds,
  }
}

// Ranks by stages solved without reveal or skip (descending), then by ranked
// time (ascending). Equal scores share a rank; unscored entries rank last.
export function rankEscapeRoomScores<
  T extends Pick<EscapeRoomAttemptScore, 'solvedStages' | 'rankedSeconds'>,
>(entries: readonly T[]): Array<T & { rank: number | null }> {
  const scored = entries
    .filter((entry) => entry.rankedSeconds !== null)
    .sort(
      (a, b) =>
        b.solvedStages - a.solvedStages ||
        (a.rankedSeconds ?? 0) - (b.rankedSeconds ?? 0)
    )

  const ranked: Array<T & { rank: number | null }> = []
  scored.forEach((entry, index) => {
    const previous = ranked[index - 1]
    const tied =
      previous &&
      previous.solvedStages === entry.solvedStages &&
      previous.rankedSeconds === entry.rankedSeconds
    ranked.push({ ...entry, rank: tied ? previous.rank : index + 1 })
  })

  return [
    ...ranked,
    ...entries
      .filter((entry) => entry.rankedSeconds === null)
      .map((entry) => ({ ...entry, rank: null })),
  ]
}
