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
    attemptsLeft: getEscapeRoomAttemptsLeft(rules, wrongAttempts),
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

// Rules of a block or activity without a configured EscapeRoomConfig: every
// rule is off.
export const ESCAPE_ROOM_RULES_OFF: EscapeRoomRules = {
  hintPenalty: 0,
  hintPenalties: [],
  wrongAnswerPenalty: 0,
  maxWrongAttempts: null,
  revealPenalty: 0,
  skipPenalty: null,
  bonusSeconds: null,
}

export function getEscapeRoomRulesFromConfig(
  config:
    | (Omit<EscapeRoomRules, 'hintPenalties'> & {
        hintPenalties?: readonly number[] | null
      })
    | null
    | undefined
): EscapeRoomRules {
  if (!config) return ESCAPE_ROOM_RULES_OFF
  return {
    hintPenalty: config.hintPenalty,
    hintPenalties: config.hintPenalties ?? [],
    wrongAnswerPenalty: config.wrongAnswerPenalty,
    maxWrongAttempts: config.maxWrongAttempts,
    revealPenalty: config.revealPenalty,
    skipPenalty: config.skipPenalty,
    bonusSeconds: config.bonusSeconds,
  }
}

// One entry per stage with rule state, stored in
// EscapeRoomAttempt.stageOutcomes. The stage key is the stack id in Practice
// Quiz and Microlearning and the element instance id in Group Activity and
// Live Quiz.
export interface EscapeRoomStageOutcomeRecord {
  stageKey: string
  wrongAttempts: number
  outcome: EscapeRoomStageOutcome | null
  at: string | null
  creditSeconds?: number
}

const STAGE_OUTCOMES = new Set<string>([
  'SOLVED',
  'REVEALED',
  'SKIPPED',
  'BONUS_CORRECT',
  'BONUS_WRONG',
])

export function parseEscapeRoomStageOutcomeRecords(
  value: unknown
): EscapeRoomStageOutcomeRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const candidate = entry as Partial<EscapeRoomStageOutcomeRecord>
    if (typeof candidate.stageKey !== 'string') return []
    return [
      {
        stageKey: candidate.stageKey,
        wrongAttempts:
          typeof candidate.wrongAttempts === 'number'
            ? candidate.wrongAttempts
            : 0,
        outcome:
          typeof candidate.outcome === 'string' &&
          STAGE_OUTCOMES.has(candidate.outcome)
            ? (candidate.outcome as EscapeRoomStageOutcome)
            : null,
        at: typeof candidate.at === 'string' ? candidate.at : null,
        ...(typeof candidate.creditSeconds === 'number'
          ? { creditSeconds: candidate.creditSeconds }
          : {}),
      },
    ]
  })
}

export function getEscapeRoomStageOutcomeRecord(
  records: readonly EscapeRoomStageOutcomeRecord[],
  stageKey: string | number
): EscapeRoomStageOutcomeRecord {
  return (
    records.find((record) => record.stageKey === String(stageKey)) ?? {
      stageKey: String(stageKey),
      wrongAttempts: 0,
      outcome: null,
      at: null,
    }
  )
}

export function setEscapeRoomStageOutcomeRecord(
  records: readonly EscapeRoomStageOutcomeRecord[],
  record: EscapeRoomStageOutcomeRecord
): EscapeRoomStageOutcomeRecord[] {
  return [
    ...records.filter((existing) => existing.stageKey !== record.stageKey),
    record,
  ]
}

// A stage is cleared once it was solved, revealed or skipped.
export function isEscapeRoomStageClearedOutcome(
  record: Pick<EscapeRoomStageOutcomeRecord, 'outcome'> | undefined
) {
  return (
    record?.outcome === 'SOLVED' ||
    record?.outcome === 'REVEALED' ||
    record?.outcome === 'SKIPPED'
  )
}

export function isEscapeRoomBonusAnswered(
  record: Pick<EscapeRoomStageOutcomeRecord, 'outcome'> | undefined
) {
  return (
    record?.outcome === 'BONUS_CORRECT' || record?.outcome === 'BONUS_WRONG'
  )
}

export type EscapeRoomAnswerableStageDecision =
  | { ok: true; stageKey: string; isBonus: boolean }
  | {
      ok: false
      reason:
        | 'not_in_progress'
        | 'expired'
        | 'bonus_answered'
        | 'locked'
        // The stage was cleared earlier (solved, revealed or skipped).
        | 'cleared'
    }

// Decides whether a stage can be answered now: the first uncleared regular
// stage of an in-progress attempt, or the unanswered bonus stage of a
// completed attempt whose time has not run out. A stage counts as cleared when
// the cleared set or its recorded outcome says so. Stages are listed in play
// order; the bonus stage, if the rules define one, is the last.
export function resolveEscapeRoomAnswerableStage({
  stages,
  stageKey,
  rules,
  status,
  expired,
  outcomes,
  clearedKeys,
}: {
  stages: readonly string[]
  stageKey: string
  rules: Pick<EscapeRoomRules, 'bonusSeconds'>
  status: string
  expired: boolean
  outcomes: readonly EscapeRoomStageOutcomeRecord[]
  clearedKeys: ReadonlySet<string>
}): EscapeRoomAnswerableStageDecision {
  const stageIndex = stages.indexOf(stageKey)
  const isBonus = isEscapeRoomBonusStage(rules, stageIndex, stages.length)
  const record = getEscapeRoomStageOutcomeRecord(outcomes, stageKey)

  if (isBonus && status === 'COMPLETED') {
    if (expired) return { ok: false, reason: 'expired' }
    if (isEscapeRoomBonusAnswered(record) || clearedKeys.has(stageKey)) {
      return { ok: false, reason: 'bonus_answered' }
    }
    return { ok: true, stageKey, isBonus: true }
  }
  if (status !== 'IN_PROGRESS') return { ok: false, reason: 'not_in_progress' }
  if (expired) return { ok: false, reason: 'expired' }
  if (stageIndex < 0 || isBonus) return { ok: false, reason: 'locked' }

  const bonusKey = isEscapeRoomBonusStage(
    rules,
    stages.length - 1,
    stages.length
  )
    ? stages[stages.length - 1]
    : undefined
  const isCleared = (key: string) =>
    clearedKeys.has(key) ||
    isEscapeRoomStageClearedOutcome(
      getEscapeRoomStageOutcomeRecord(outcomes, key)
    )
  const current = stages.find((key) => key !== bonusKey && !isCleared(key))
  if (current === stageKey) return { ok: true, stageKey, isBonus: false }
  return { ok: false, reason: isCleared(stageKey) ? 'cleared' : 'locked' }
}

// True when every regular stage (all stages but the bonus) is cleared.
export function areEscapeRoomRegularStagesCleared({
  stages,
  rules,
  outcomes,
  clearedKeys,
}: {
  stages: readonly string[]
  rules: Pick<EscapeRoomRules, 'bonusSeconds'>
  outcomes: readonly EscapeRoomStageOutcomeRecord[]
  clearedKeys: ReadonlySet<string>
}) {
  const regular = stages.filter(
    (_, index) => !isEscapeRoomBonusStage(rules, index, stages.length)
  )
  return (
    regular.length > 0 &&
    regular.every(
      (key) =>
        clearedKeys.has(key) ||
        isEscapeRoomStageClearedOutcome(
          getEscapeRoomStageOutcomeRecord(outcomes, key)
        )
    )
  )
}
