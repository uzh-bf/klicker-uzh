// Mode-independent view of the stages of an escape room. Each mode records
// stage progress differently, so the frame reads it through one of the entry
// functions below instead of inspecting attempts itself. The bonus stage is
// the last stage when the rules grant bonus time (see hasBonusStage); it is
// never required to complete the room.

export type EscapeRoomStageKind = 'regular' | 'bonus'

export type EscapeRoomStageState =
  | 'open'
  | 'current'
  | 'solved'
  | 'revealed'
  | 'skipped'
  | 'bonusCorrect'
  | 'bonusWrong'

export interface EscapeRoomStageView {
  index: number
  kind: EscapeRoomStageKind
  state: EscapeRoomStageState
  wrongAttempts?: number
}

export interface EscapeRoomStages {
  stages: EscapeRoomStageView[]
  // regular stages the team or participant has to clear
  requiredCount: number
  // 1 when the room has a bonus stage, otherwise 0
  bonusCount: number
  // regular stages that are solved, revealed or skipped
  clearedCount: number
}

// Structural subset of the generated EscapeRoomStageOutcome type
export interface EscapeRoomStageOutcomeEntry {
  stageKey: string
  wrongAttempts?: number | null
  outcome?: string | null
}

const OUTCOME_STATES: Record<string, EscapeRoomStageState> = {
  SOLVED: 'solved',
  REVEALED: 'revealed',
  SKIPPED: 'skipped',
  BONUS_CORRECT: 'bonusCorrect',
  BONUS_WRONG: 'bonusWrong',
}

type ResolvedStage = { state?: EscapeRoomStageState; wrongAttempts?: number }

function resolveFromOutcome(
  entry: EscapeRoomStageOutcomeEntry | undefined
): ResolvedStage {
  const state = entry?.outcome ? OUTCOME_STATES[entry.outcome] : undefined
  return {
    state,
    wrongAttempts: entry?.wrongAttempts ?? undefined,
  }
}

function assemble(
  resolved: ResolvedStage[],
  hasBonus: boolean
): EscapeRoomStages {
  const total = resolved.length
  const bonusCount = hasBonus && total > 1 ? 1 : 0
  const requiredCount = total - bonusCount

  const firstUncleared = resolved.findIndex(
    (stage, index) => index < requiredCount && !stage.state
  )
  // the bonus stage only becomes current once every regular stage is cleared
  const currentIndex =
    firstUncleared !== -1
      ? firstUncleared
      : bonusCount === 1 && !resolved[total - 1]?.state
        ? total - 1
        : -1

  const stages = resolved.map<EscapeRoomStageView>((stage, index) => ({
    index,
    kind: index >= requiredCount ? 'bonus' : 'regular',
    state: stage.state ?? (index === currentIndex ? 'current' : 'open'),
    ...(stage.wrongAttempts ? { wrongAttempts: stage.wrongAttempts } : {}),
  }))

  return {
    stages,
    requiredCount,
    bonusCount,
    clearedCount: stages.filter(
      (stage) =>
        stage.kind === 'regular' &&
        stage.state !== 'open' &&
        stage.state !== 'current'
    ).length,
  }
}

// Practice Quiz and Microlearning: the stage key is the stack id. A regular
// stack that is already answered correctly counts as solved. Stacks can be
// withheld before an attempt starts, so the stage count may exceed stacks.
// Once an attempt has expired every stack is withheld; stages are cleared in
// order, so the recorded outcomes then fill the stages from the first one.
export function getIndividualEscapeRoomStages({
  stacks,
  totalStages,
  hasBonus,
  stageOutcomes,
}: {
  stacks?: ReadonlyArray<{
    id: string | number
    isCorrect?: boolean | null
  }> | null
  totalStages?: number | null
  hasBonus: boolean
  stageOutcomes?: ReadonlyArray<EscapeRoomStageOutcomeEntry> | null
}): EscapeRoomStages {
  const total = totalStages ?? stacks?.length ?? 0
  const bonusIndex = hasBonus && total > 1 ? total - 1 : -1
  const withheldOutcomes = stacks?.length
    ? []
    : (stageOutcomes ?? []).filter((outcome) => outcome.outcome)
  const resolved = Array.from({ length: total }, (_, index): ResolvedStage => {
    const stack = stacks?.[index]
    const entry = stack
      ? stageOutcomes?.find((outcome) => outcome.stageKey === String(stack.id))
      : withheldOutcomes[index]
    const fromOutcome = resolveFromOutcome(entry)
    return !fromOutcome.state && index !== bonusIndex && stack?.isCorrect
      ? { ...fromOutcome, state: 'solved' }
      : fromOutcome
  })
  return assemble(resolved, hasBonus)
}

// Group Activity: the stage key is the element instance id. A solved stage is
// only recorded as a decision; reveal, skip and bonus results are outcomes.
// The server withholds locked stages, so the ids cover the stages up to the
// current one and the total comes separately; unknown stages stay open.
export function getGroupEscapeRoomStages({
  stageInstanceIds,
  totalStages,
  hasBonus,
  stageDecisions,
  stageOutcomes,
}: {
  stageInstanceIds: readonly (string | number)[]
  totalStages?: number | null
  hasBonus: boolean
  stageDecisions?: ReadonlyArray<{ instanceId: string | number }> | null
  stageOutcomes?: ReadonlyArray<EscapeRoomStageOutcomeEntry> | null
}): EscapeRoomStages {
  const total = Math.max(totalStages ?? 0, stageInstanceIds.length)
  const bonusCount = hasBonus && total > 1 ? 1 : 0

  // After expiry every stage is withheld. Cleared stages can still be
  // counted, but not placed in order, so only the counts are reported.
  if (stageInstanceIds.length === 0) {
    const clearedKeys = new Set([
      ...(stageDecisions ?? []).map((decision) => String(decision.instanceId)),
      ...(stageOutcomes ?? [])
        .filter((entry) => entry.outcome && !entry.outcome.startsWith('BONUS'))
        .map((entry) => entry.stageKey),
    ])
    if (clearedKeys.size > 0) {
      return {
        stages: [],
        requiredCount: total - bonusCount,
        bonusCount,
        clearedCount: Math.min(clearedKeys.size, total - bonusCount),
      }
    }
  }

  const bonusIndex = hasBonus ? total - 1 : -1
  const resolved = Array.from({ length: total }, (_, index): ResolvedStage => {
    const instanceId = stageInstanceIds[index]
    if (instanceId === undefined) return {}
    const fromOutcome = resolveFromOutcome(
      stageOutcomes?.find((outcome) => outcome.stageKey === String(instanceId))
    )
    if (fromOutcome.state || index === bonusIndex) return fromOutcome
    const decided = stageDecisions?.some(
      (decision) => String(decision.instanceId) === String(instanceId)
    )
    return decided ? { ...fromOutcome, state: 'solved' } : fromOutcome
  })
  return assemble(resolved, hasBonus)
}

// Live Quiz only reports a cleared prefix of the instances; there is no
// reveal, skip or bonus.
export function getLiveEscapeRoomStages({
  clearedCount,
  totalCount,
}: {
  clearedCount: number
  totalCount: number
}): EscapeRoomStages {
  const resolved = Array.from(
    { length: Math.max(totalCount, 0) },
    (_, index): ResolvedStage =>
      index < clearedCount ? { state: 'solved' } : {}
  )
  return assemble(resolved, false)
}

// Ranked time shown on the student ending. Matches rankedSeconds of the
// lecturer view (scoreEscapeRoomAttempt in @klicker-uzh/grading): the attempt
// completes at the last regular stage outcome, penalties are added and the
// bonus credit is subtracted only after a correct bonus answer. Returns null
// while the attempt is not completed.
export function getEscapeRankedSeconds({
  startedAt,
  completedAt,
  penaltySeconds,
  bonusSeconds,
  bonusOutcome,
}: {
  startedAt?: string | null
  completedAt?: string | null
  penaltySeconds?: number | null
  bonusSeconds?: number | null
  bonusOutcome?: string | null
}): number | null {
  if (!startedAt || !completedAt) return null
  const elapsed = Math.max(
    Math.round(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
    ),
    0
  )
  const credit = bonusOutcome === 'BONUS_CORRECT' ? (bonusSeconds ?? 0) : 0
  return elapsed + (penaltySeconds ?? 0) - credit
}
