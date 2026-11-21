import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faCircleXmark,
  faClock,
  faDoorClosed,
  faDoorOpen,
  faEye,
  faForward,
  faHourglassEnd,
  faLayerGroup,
  faLightbulb,
  faStar,
  faTriangleExclamation,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import {
  type EscapeRoomStages,
  type EscapeRoomStageView,
  getEscapeRankedSeconds,
} from '@lib/escapeRoomStages'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ReactNode, useEffect, useId, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import EscapeRoomStageTracker, {
  ESCAPE_ROOM_FRAME as FRAME,
  type EscapeRoomTranslate,
  getEscapeRoomStageMarker,
} from './EscapeRoomStageTracker'

// Minimal structural view of an EscapeRoomAttempt as selected by the
// participant-facing fragments — enough to derive the completion stats.
interface EscapeRoomAttemptStats {
  startedAt?: string | null
  completedAt?: string | null
  penaltySeconds?: number | null
  hintsUsed?: unknown | null
}

export type EscapeRoomMode =
  | 'practiceQuiz'
  | 'microLearning'
  | 'groupActivity'
  | 'liveQuiz'

// Structural subset of the escape room config the start dialog lists.
export interface EscapeRoomRules {
  timeLimit: number // in seconds
  hintPenalty: number // in seconds
  hintPenalties?: number[] | null
  lockoutSeconds?: number | null
  wrongAnswerPenalty?: number | null
  maxWrongAttempts?: number | null
  revealPenalty?: number | null
  skipPenalty?: number | null
  bonusSeconds?: number | null
}

interface EscapeRoomOverlayProps {
  mode: EscapeRoomMode
  // activity name shown as the heading of the start dialog
  title?: string | null
  rules: EscapeRoomRules
  isStarted: boolean
  isCompleted: boolean
  isExpired: boolean
  remainingSeconds: number | null
  onStart: () => Promise<void>
  loading?: boolean
  attempt?: EscapeRoomAttemptStats | null
  // stage counts and per-stage states from the mode's stage adapter
  stages?: EscapeRoomStages
  // lecturer-authored story shown on the start screen instead of the
  // generic mode description (markdown supported)
  introText?: string | null
  // where the student continues from the dialogs; omitted when there is
  // nowhere to go (e.g. an embedded Practice Quiz)
  exit?: { label: string; onClick: () => void }
  // make the in-attempt bar span the full width of a Layout body (cancels its
  // p-4 padding, including the sticky offset, which is measured from the
  // padding-free content edge) instead of sitting inside it
  flush?: boolean
  // set when the room has a bonus stage that follows completion; the bonus
  // question is answered once while the clock still runs
  bonus?: {
    seconds: number
    available: boolean
    // BONUS_CORRECT, BONUS_WRONG, or any other value once answered with an
    // unknown result
    outcome?: string | null
    onStart?: () => void
  }
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// "30 s", "2 min", "2 min 30 s"
export function formatDuration(seconds: number, t: EscapeRoomTranslate) {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  const secs = safe % 60
  if (minutes === 0) {
    return t('pwa.practiceQuiz.escapeRoomDurationSeconds', { seconds: secs })
  }
  if (secs === 0) {
    return t('pwa.practiceQuiz.escapeRoomDurationMinutes', { minutes })
  }
  return t('pwa.practiceQuiz.escapeRoomDurationMinutesSeconds', {
    minutes,
    seconds: secs,
  })
}

function StatRow({
  label,
  value,
  dataCy,
}: {
  label: string
  value: ReactNode
  dataCy?: string
}) {
  return (
    <div className="flex justify-between" data-cy={dataCy}>
      <span className="text-slate-400">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

interface RuleRow {
  cy: string
  icon: IconDefinition
  label: string
  value: ReactNode
  seconds?: number
  count?: number
  lockout?: number
}

function RuleList({ rows, label }: { rows: RuleRow[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className={twMerge(
        'w-full divide-y divide-slate-700 rounded-lg border bg-slate-900/50 text-sm',
        FRAME.panel
      )}
      data-cy="escape-room-rules"
    >
      {rows.map((row, index) => (
        <li
          key={`${row.cy}-${index}`}
          className="flex items-center gap-3 px-3 py-2"
          data-cy={row.cy}
          data-seconds={row.seconds}
          data-count={row.count}
          data-lockout={row.lockout}
        >
          <FontAwesomeIcon
            icon={row.icon}
            className={twMerge('w-4 flex-none', FRAME.muted)}
            aria-hidden="true"
          />
          <span className="flex-1 text-slate-300">{row.label}</span>
          <span className="text-right font-semibold text-white">
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

function StageRecap({
  stages,
  ended = false,
}: {
  stages: EscapeRoomStages
  ended?: boolean
}) {
  const t = useTranslations()
  if (stages.stages.length === 0) return null

  return (
    <div
      className="w-full space-y-3 text-left text-sm"
      data-cy="escape-room-stage-recap"
    >
      <ul className="space-y-1.5">
        {stages.stages.map((rawStage) => {
          // once the attempt is over, no stage is in progress any more
          const stage: EscapeRoomStageView =
            ended && rawStage.state === 'current'
              ? { ...rawStage, state: 'open' }
              : rawStage
          const marker = getEscapeRoomStageMarker(stage, t)
          const label =
            ended && stage.state === 'open' && stage.kind !== 'bonus'
              ? t('pwa.practiceQuiz.escapeRoomStageUnsolved', {
                  number: stage.index + 1,
                })
              : marker.label
          return (
            <li
              key={stage.index}
              className="flex items-center gap-2"
              data-cy="escape-room-stage-recap-row"
              data-state={stage.state}
            >
              <span
                className={twMerge(
                  'flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[10px]',
                  FRAME.marker,
                  marker.className
                )}
                aria-hidden="true"
              >
                <FontAwesomeIcon icon={marker.icon} />
              </span>
              <span className="flex-1 text-slate-300">{label}</span>
              {!!stage.wrongAttempts && (
                <span className={twMerge('text-xs', FRAME.muted)}>
                  {t('pwa.practiceQuiz.escapeRoomWrongAttempts', {
                    count: stage.wrongAttempts,
                  })}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Shared shell of the start, completed and expired dialogs: dark backdrop and
// one card that scrolls as a whole. Focus moves into the card on open, stays
// inside while it is mounted and returns to the previous element on close.
function DialogShell({
  labelledBy,
  className,
  children,
  ...dataAttributes
}: {
  labelledBy: string
  className?: string
  children: ReactNode
  'data-cy'?: string
  'data-outcome'?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const previous = document.activeElement as HTMLElement | null
    card.focus({ preventScroll: true })

    const focusables = () =>
      Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        card.focus()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const active = document.activeElement
      if (!card.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || active === card)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!card.contains(event.target as Node)) {
        ;(focusables()[0] ?? card).focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      if (previous && document.contains(previous)) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4 text-white backdrop-blur-sm">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={twMerge(
          'w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border bg-slate-800 p-6 shadow-2xl outline-none motion-safe:animate-fade-in sm:p-8',
          className
        )}
        {...dataAttributes}
      >
        {children}
      </div>
    </div>
  )
}

export default function EscapeRoomOverlay({
  mode,
  title,
  rules,
  isStarted,
  isCompleted,
  isExpired,
  remainingSeconds,
  onStart,
  loading = false,
  attempt,
  stages,
  introText,
  exit,
  flush = false,
  bonus,
}: EscapeRoomOverlayProps) {
  const t = useTranslations()
  const headingId = useId()
  // A Live Quiz without scoring rules keeps its plain escape time ending.
  const plainLive =
    mode === 'liveQuiz' &&
    !(
      (rules.wrongAnswerPenalty ?? 0) > 0 ||
      rules.maxWrongAttempts != null ||
      rules.skipPenalty != null ||
      (rules.bonusSeconds ?? 0) > 0
    )
  const isGroup = mode === 'groupActivity'
  const timeLimit = rules.timeLimit

  const totalStacks = stages?.requiredCount
  const clearedStacks = stages?.clearedCount
  const hintsUsedCount = Array.isArray(attempt?.hintsUsed)
    ? attempt.hintsUsed.length
    : null
  const penaltySeconds = attempt?.penaltySeconds ?? 0
  const escapeSeconds =
    attempt?.startedAt && attempt?.completedAt
      ? (new Date(attempt.completedAt).getTime() -
          new Date(attempt.startedAt).getTime()) /
        1000
      : null

  // Full page block overlays for start, completed, expired states
  if (!isStarted) {
    const rows: RuleRow[] = []
    if (typeof totalStacks === 'number' && totalStacks > 0) {
      rows.push({
        cy: 'escape-room-rule-stages',
        icon: faLayerGroup,
        label: t('pwa.practiceQuiz.escapeRoomStagesLabel'),
        value: t('pwa.practiceQuiz.escapeRoomStageCount', {
          required: stages?.requiredCount ?? 0,
          bonus: stages?.bonusCount ?? 0,
        }),
        count: stages?.requiredCount,
      })
    }
    rows.push({
      cy: 'escape-room-rule-time-limit',
      icon: faClock,
      label: t('pwa.practiceQuiz.escapeRoomTimeLimitLabel'),
      value: formatDuration(timeLimit, t),
      seconds: timeLimit,
    })
    const hintPenalties = rules.hintPenalties ?? []
    if (hintPenalties.length > 0) {
      hintPenalties.forEach((penalty, index) => {
        rows.push({
          cy: 'escape-room-rule-hint',
          icon: faLightbulb,
          label: t('pwa.practiceQuiz.escapeRoomRuleHintNumber', {
            number: index + 1,
          }),
          value: `+${formatDuration(penalty, t)}`,
          seconds: penalty,
        })
      })
    } else if (rules.hintPenalty > 0) {
      rows.push({
        cy: 'escape-room-rule-hint',
        icon: faLightbulb,
        label: t('pwa.practiceQuiz.escapeRoomRuleHintEach'),
        value: `+${formatDuration(rules.hintPenalty, t)}`,
        seconds: rules.hintPenalty,
      })
    }
    const wrongPenalty = plainLive ? 0 : (rules.wrongAnswerPenalty ?? 0)
    const lockout = rules.lockoutSeconds ?? 0
    if (wrongPenalty > 0 || lockout > 0) {
      rows.push({
        cy: 'escape-room-rule-wrong-answer',
        icon: faCircleXmark,
        label: t('pwa.practiceQuiz.escapeRoomRuleWrongAnswer'),
        value: [
          wrongPenalty > 0 ? `+${formatDuration(wrongPenalty, t)}` : null,
          lockout > 0
            ? t('pwa.practiceQuiz.escapeRoomRuleWait', {
                duration: formatDuration(lockout, t),
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        seconds: wrongPenalty,
        lockout,
      })
    }
    if (!plainLive) {
      if (rules.maxWrongAttempts != null && rules.maxWrongAttempts > 0) {
        const revealPenalty = rules.revealPenalty ?? 0
        rows.push({
          cy: 'escape-room-rule-reveal',
          icon: faEye,
          label: t('pwa.practiceQuiz.escapeRoomRuleReveal', {
            count: rules.maxWrongAttempts,
          }),
          value:
            revealPenalty > 0
              ? `+${formatDuration(revealPenalty, t)}`
              : t('pwa.practiceQuiz.escapeRoomRuleNoPenalty'),
          seconds: revealPenalty,
          count: rules.maxWrongAttempts,
        })
      }
      if (rules.skipPenalty != null) {
        rows.push({
          cy: 'escape-room-rule-skip',
          icon: faForward,
          label: t('pwa.practiceQuiz.escapeRoomRuleSkip'),
          value:
            rules.skipPenalty > 0
              ? `+${formatDuration(rules.skipPenalty, t)}`
              : t('pwa.practiceQuiz.escapeRoomRuleNoPenalty'),
          seconds: rules.skipPenalty,
        })
      }
      if (
        rules.bonusSeconds != null &&
        rules.bonusSeconds > 0 &&
        (stages?.bonusCount ?? 0) > 0
      ) {
        rows.push({
          cy: 'escape-room-rule-bonus',
          icon: faStar,
          label: t('pwa.practiceQuiz.escapeRoomRuleBonus'),
          value: `−${formatDuration(rules.bonusSeconds, t)}`,
          seconds: rules.bonusSeconds,
        })
      }
    }

    return (
      <DialogShell key="start" labelledBy={headingId} className="space-y-5">
        <div className="space-y-1">
          <div
            className={twMerge(
              'flex items-center gap-2 text-xs font-semibold tracking-wide uppercase',
              FRAME.muted
            )}
          >
            <FontAwesomeIcon icon={faDoorClosed} aria-hidden="true" />
            <span>{t('pwa.practiceQuiz.escapeRoomTitle')}</span>
          </div>
          <div id={headingId}>
            <H3
              className={{ root: 'text-2xl font-bold break-words text-white' }}
            >
              {title || t('pwa.practiceQuiz.escapeRoomStartTitle')}
            </H3>
          </div>
        </div>
        {introText ? (
          <div
            className="prose prose-sm prose-invert w-full leading-relaxed text-slate-300"
            data-cy="escape-room-intro-text-display"
          >
            <DynamicMarkdown content={introText} />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-300">
            {isGroup
              ? t('pwa.practiceQuiz.escapeRoomStartDescGroup')
              : t('pwa.practiceQuiz.escapeRoomStartDesc')}
          </p>
        )}
        <RuleList
          rows={rows}
          label={t('pwa.practiceQuiz.escapeRoomRulesLabel')}
        />
        {!plainLive && (
          <p className={twMerge('text-xs leading-relaxed', FRAME.muted)}>
            {t('pwa.practiceQuiz.escapeRoomRankingNote')}
          </p>
        )}
        <div
          className={twMerge(
            'flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm leading-snug',
            FRAME.warn
          )}
          data-cy="escape-room-start-warning"
        >
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mt-0.5 flex-none"
            aria-hidden="true"
          />
          <p>
            {isGroup
              ? t('pwa.practiceQuiz.escapeRoomStartWarningGroup')
              : t('pwa.practiceQuiz.escapeRoomStartWarning')}
          </p>
        </div>
        <div className="space-y-2">
          <Button
            primary
            disabled={loading}
            className={{ root: 'h-11 w-full text-lg font-bold' }}
            onClick={onStart}
            data={{ cy: 'escape-room-start' }}
          >
            <Button.Label>
              {loading
                ? t('shared.generic.loading')
                : t('pwa.practiceQuiz.escapeRoomStartButton')}
            </Button.Label>
          </Button>
          {exit && (
            <Button
              basic
              className={{
                root: 'w-full justify-center text-slate-300 hover:bg-slate-700 hover:text-white',
              }}
              onClick={exit.onClick}
              data={{ cy: 'escape-room-start-exit' }}
            >
              <Button.Label>
                {t('pwa.practiceQuiz.escapeRoomNotNow')}
              </Button.Label>
            </Button>
          )}
        </div>
      </DialogShell>
    )
  }

  if (isExpired) {
    return (
      <DialogShell
        key="expired"
        labelledBy={headingId}
        className="space-y-5 border-red-900/50 text-center"
        data-cy="escape-room-expired"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white">
          <FontAwesomeIcon icon={faHourglassEnd} aria-hidden="true" />
        </div>
        <div id={headingId}>
          <H3 className={{ root: 'text-2xl font-bold text-red-400' }}>
            {t('pwa.practiceQuiz.escapeRoomExpiredTitle')}
          </H3>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">
          {t('pwa.practiceQuiz.escapeRoomExpiredDesc')}
        </p>
        {typeof totalStacks === 'number' &&
          totalStacks > 0 &&
          typeof clearedStacks === 'number' && (
            <p
              className="text-sm font-semibold text-amber-400"
              data-cy="escape-room-expired-progress"
            >
              {t('pwa.practiceQuiz.escapeRoomClearedProgress', {
                cleared: clearedStacks,
                total: totalStacks,
              })}
            </p>
          )}
        {stages && <StageRecap stages={stages} ended />}
        {exit && (
          <Button
            primary
            className={{ root: 'h-11 w-full font-bold' }}
            onClick={exit.onClick}
            data={{ cy: 'escape-room-exit' }}
          >
            <Button.Label>{exit.label}</Button.Label>
          </Button>
        )}
        <p className="text-xs leading-relaxed text-slate-400">
          {t('pwa.practiceQuiz.escapeRoomContactLecturer')}
        </p>
      </DialogShell>
    )
  }

  if (isCompleted) {
    const requiredStages =
      stages?.stages.filter((stage) => stage.kind === 'regular') ?? []
    const revealedCount = requiredStages.filter(
      (stage) => stage.state === 'revealed'
    ).length
    const skippedCount = requiredStages.filter(
      (stage) => stage.state === 'skipped'
    ).length
    const solvedCount = requiredStages.filter(
      (stage) => stage.state === 'solved'
    ).length
    const isAssisted = revealedCount + skippedCount > 0
    const bonusCredited = bonus?.outcome === 'BONUS_CORRECT'
    const rankedSeconds = plainLive
      ? null
      : getEscapeRankedSeconds({
          startedAt: attempt?.startedAt,
          completedAt: attempt?.completedAt,
          penaltySeconds: attempt?.penaltySeconds,
          bonusSeconds: bonus?.seconds ?? rules.bonusSeconds,
          bonusOutcome: bonus?.outcome,
        })
    const headlineSeconds = plainLive
      ? escapeSeconds !== null
        ? Math.max(0, Math.round(escapeSeconds))
        : null
      : rankedSeconds !== null
        ? Math.max(0, rankedSeconds)
        : null
    const bonusOffered = !!bonus?.available && !!bonus.onStart

    return (
      <DialogShell
        key="completed"
        labelledBy={headingId}
        className="space-y-5 border-green-900/50"
        data-cy="escape-room-completed"
        data-outcome={isAssisted ? 'assisted' : 'clean'}
      >
        <div className="space-y-4 text-center">
          <div
            className={twMerge(
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white',
              isAssisted ? 'bg-slate-600' : 'bg-green-600'
            )}
          >
            <FontAwesomeIcon
              icon={isAssisted ? faDoorOpen : faTrophy}
              aria-hidden="true"
            />
          </div>
          <div id={headingId}>
            <H3
              className={{
                root: twMerge(
                  'text-2xl font-bold',
                  isAssisted ? 'text-white' : 'text-green-400'
                ),
              }}
            >
              {isAssisted
                ? t('pwa.practiceQuiz.escapeRoomAssistedTitle')
                : t('pwa.practiceQuiz.escapeRoomCompletedTitle')}
            </H3>
          </div>
          {isAssisted ? (
            <p className="text-sm leading-relaxed text-slate-300">
              {t('pwa.practiceQuiz.escapeRoomAssistedSummary', {
                solved: solvedCount,
                required: requiredStages.length,
              })}
              {revealedCount > 0 &&
                `, ${t('pwa.practiceQuiz.escapeRoomRevealedCount', { count: revealedCount })}`}
              {skippedCount > 0 &&
                `, ${t('pwa.practiceQuiz.escapeRoomSkippedCount', { count: skippedCount })}`}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">
              {t('pwa.practiceQuiz.escapeRoomCompletedDesc')}
            </p>
          )}
        </div>
        {headlineSeconds !== null && (
          <div className="text-center">
            <div className={twMerge('text-xs uppercase', FRAME.muted)}>
              {plainLive
                ? t('pwa.practiceQuiz.escapeRoomStatsTime')
                : t('pwa.practiceQuiz.escapeRoomRankedTimeLabel')}
            </div>
            <div
              className="text-4xl font-bold text-white"
              data-cy={
                plainLive
                  ? 'escape-room-escape-time'
                  : 'escape-room-ranked-time'
              }
              data-seconds={headlineSeconds}
            >
              {formatDuration(headlineSeconds, t)}
            </div>
          </div>
        )}
        {bonusOffered && (
          <div className="w-full space-y-3 rounded-lg border border-amber-700/50 bg-slate-900/50 p-4 text-sm text-slate-300">
            <p>{t('pwa.practiceQuiz.escapeRoomBonusDesc')}</p>
            <Button
              primary
              className={{ root: 'w-full font-bold' }}
              onClick={bonus.onStart}
              data={{ cy: 'escape-room-bonus' }}
            >
              <Button.Label>
                {t('pwa.practiceQuiz.escapeRoomBonusOffer', {
                  duration: formatDuration(bonus.seconds, t),
                })}
              </Button.Label>
            </Button>
          </div>
        )}
        {bonus?.outcome && (
          <p
            className="text-center text-sm font-semibold text-amber-400"
            data-cy="escape-room-bonus-result"
            data-outcome={bonus.outcome}
          >
            {bonus.outcome === 'BONUS_CORRECT'
              ? t('pwa.practiceQuiz.escapeRoomBonusCorrect', {
                  duration: formatDuration(bonus.seconds, t),
                })
              : bonus.outcome === 'BONUS_WRONG'
                ? t('pwa.practiceQuiz.escapeRoomBonusWrong')
                : t('pwa.practiceQuiz.escapeRoomBonusSubmitted')}
          </p>
        )}
        {(escapeSeconds !== null ||
          hintsUsedCount !== null ||
          penaltySeconds > 0) && (
          <div
            className="w-full space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-left text-xs"
            data-cy="escape-room-completed-stats"
          >
            {escapeSeconds !== null && !plainLive && (
              <StatRow
                label={t('pwa.practiceQuiz.escapeRoomStatsTime')}
                value={
                  <span className="text-green-400">
                    {formatTime(escapeSeconds)}
                  </span>
                }
              />
            )}
            {hintsUsedCount !== null && (
              <StatRow
                label={t('pwa.practiceQuiz.escapeRoomStatsHints')}
                value={hintsUsedCount}
              />
            )}
            {penaltySeconds > 0 && (
              <StatRow
                label={t('pwa.practiceQuiz.escapeRoomStatsPenalty')}
                value={
                  <span className="text-amber-400">
                    +{formatTime(penaltySeconds)}
                  </span>
                }
              />
            )}
            {bonusCredited && !plainLive && (
              <StatRow
                dataCy="escape-room-stats-bonus"
                label={t('pwa.practiceQuiz.escapeRoomStatsBonus')}
                value={
                  <span className="text-green-400">
                    −{formatTime(bonus?.seconds ?? 0)}
                  </span>
                }
              />
            )}
          </div>
        )}
        {stages && <StageRecap stages={stages} />}
        {exit && (
          <Button
            primary={!bonusOffered}
            className={{
              // the secondary variant is light, so it needs dark text on the
              // dark card
              root: twMerge(
                'h-11 w-full font-bold',
                bonusOffered && 'text-slate-900'
              ),
            }}
            onClick={exit.onClick}
            data={{ cy: 'escape-room-exit' }}
          >
            <Button.Label>{exit.label}</Button.Label>
          </Button>
        )}
      </DialogShell>
    )
  }

  // Active in-progress state: Render the sticky timer banner/bar
  const warnAt = Math.max(60, timeLimit / 10)
  const criticalAt = Math.min(60, timeLimit / 10)
  const timerState =
    remainingSeconds === null
      ? 'normal'
      : remainingSeconds <= criticalAt
        ? 'critical'
        : remainingSeconds <= warnAt
          ? 'warning'
          : 'normal'
  const timerAnnouncement =
    timerState === 'critical'
      ? t('pwa.practiceQuiz.escapeRoomTimeCritical', {
          seconds: Math.ceil(criticalAt),
        })
      : timerState === 'warning'
        ? t('pwa.practiceQuiz.escapeRoomTimeWarning', {
            minutes: Math.ceil(warnAt / 60),
          })
        : ''

  // Layout drops its horizontal padding inside a frame (LMS embeds), so the
  // bar must not reach past it there.
  const pageInFrame =
    global?.window &&
    global?.window?.location !== global?.window?.parent.location

  // Markers need room: up to 6 below sm, up to 12 from sm up; beyond that only
  // the counter chip remains.
  const stageViews = stages?.stages ?? []
  const showMarkers = stageViews.length > 0 && stageViews.length <= 12
  const markersBelowSm = stageViews.length <= 6
  // the label gives way below sm once the markers need its room
  const hideLabelBelowSm =
    showMarkers && markersBelowSm && stageViews.length > 3

  return (
    <div
      className={twMerge(
        'sticky top-0 z-[50] flex w-full items-center justify-between gap-2 border-b px-3 py-2 shadow-md sm:px-4',
        FRAME.bar,
        flush && '-top-4 -mt-4',
        flush && !pageInFrame && '-mx-4 w-auto'
      )}
    >
      <div className="flex flex-none items-center gap-2 text-sm">
        <FontAwesomeIcon icon={faDoorOpen} className={FRAME.muted} />
        <span
          className={twMerge(
            'font-semibold text-white',
            hideLabelBelowSm && 'sr-only sm:not-sr-only'
          )}
        >
          {t('pwa.practiceQuiz.escapeRoomTitle')}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {showMarkers && (
          <EscapeRoomStageTracker
            stages={stageViews}
            className={markersBelowSm ? undefined : 'max-sm:hidden'}
          />
        )}
        {typeof totalStacks === 'number' &&
          totalStacks > 0 &&
          typeof clearedStacks === 'number' && (
            <div
              aria-label={t('pwa.practiceQuiz.escapeRoomStagesCleared')}
              className={twMerge(
                'flex flex-none items-center gap-1 rounded border px-2 py-1 text-sm whitespace-nowrap',
                FRAME.chip
              )}
              data-cy="escape-room-progress-chip"
              data-cleared={clearedStacks}
              data-required={totalStacks}
              data-bonus={stages?.bonusCount ?? 0}
            >
              <span className="font-semibold text-white">{clearedStacks}</span>
              <span>/</span>
              <span>{totalStacks}</span>
            </div>
          )}
        <div
          role="timer"
          aria-label={t('pwa.practiceQuiz.escapeRoomTimeRemaining')}
          data-cy="escape-room-timer"
          data-state={timerState}
          className={twMerge(
            'flex flex-none items-center gap-1.5 rounded border px-2 py-1 font-mono text-sm font-bold tracking-wider whitespace-nowrap sm:text-base',
            FRAME.panel,
            timerState === 'normal' && 'text-white',
            timerState === 'warning' && FRAME.warn,
            timerState === 'critical' &&
              twMerge(
                FRAME.danger,
                FRAME.dangerBorder,
                'motion-safe:animate-pulse'
              )
          )}
        >
          <FontAwesomeIcon
            icon={faClock}
            className={
              timerState === 'normal'
                ? FRAME.muted
                : timerState === 'warning'
                  ? FRAME.warn
                  : FRAME.danger
            }
          />
          <span>
            {remainingSeconds !== null ? formatTime(remainingSeconds) : '00:00'}
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          {timerAnnouncement}
        </span>
      </div>
    </div>
  )
}
