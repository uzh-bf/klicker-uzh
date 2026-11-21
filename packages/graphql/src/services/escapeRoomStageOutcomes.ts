import type {
  EscapeRoomRules,
  EscapeRoomStageOutcome,
} from '@klicker-uzh/grading'
import type * as DB from '@klicker-uzh/prisma/client'

// One entry per stage with rule state, stored in EscapeRoomAttempt.stageOutcomes.
// The stage key is the stack id in Practice Quiz and Microlearning and the
// element instance id in Group Activity.
export interface EscapeRoomStageOutcomeEntry {
  stageKey: string
  wrongAttempts: number
  outcome: EscapeRoomStageOutcome | null
  at: string | null
  creditSeconds?: number
}

const OUTCOMES = new Set<string>([
  'SOLVED',
  'REVEALED',
  'SKIPPED',
  'BONUS_CORRECT',
  'BONUS_WRONG',
])

export function parseEscapeRoomStageOutcomes(
  value: unknown
): EscapeRoomStageOutcomeEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const candidate = entry as Partial<EscapeRoomStageOutcomeEntry>
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
          OUTCOMES.has(candidate.outcome)
            ? candidate.outcome
            : null,
        at: typeof candidate.at === 'string' ? candidate.at : null,
        ...(typeof candidate.creditSeconds === 'number'
          ? { creditSeconds: candidate.creditSeconds }
          : {}),
      },
    ]
  })
}

export function getStageOutcome(
  entries: EscapeRoomStageOutcomeEntry[],
  stageKey: string | number
): EscapeRoomStageOutcomeEntry {
  return (
    entries.find((entry) => entry.stageKey === String(stageKey)) ?? {
      stageKey: String(stageKey),
      wrongAttempts: 0,
      outcome: null,
      at: null,
    }
  )
}

export function setStageOutcome(
  entries: EscapeRoomStageOutcomeEntry[],
  entry: EscapeRoomStageOutcomeEntry
): EscapeRoomStageOutcomeEntry[] {
  return [
    ...entries.filter((existing) => existing.stageKey !== entry.stageKey),
    entry,
  ]
}

// Reveal and skip clear a stage without a correct answer.
export function isClearedWithoutAnswer(
  entry: Pick<EscapeRoomStageOutcomeEntry, 'outcome'> | undefined
) {
  return entry?.outcome === 'REVEALED' || entry?.outcome === 'SKIPPED'
}

export function isBonusAnswered(
  entry: Pick<EscapeRoomStageOutcomeEntry, 'outcome'> | undefined
) {
  return entry?.outcome === 'BONUS_CORRECT' || entry?.outcome === 'BONUS_WRONG'
}

export function getEscapeRoomRules(
  config: Pick<
    DB.EscapeRoomConfig,
    | 'hintPenalty'
    | 'hintPenalties'
    | 'wrongAnswerPenalty'
    | 'maxWrongAttempts'
    | 'revealPenalty'
    | 'skipPenalty'
    | 'bonusSeconds'
  >
): EscapeRoomRules {
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
