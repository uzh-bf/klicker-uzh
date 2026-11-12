import {
  faClock,
  faDoorOpen,
  faHourglassEnd,
  faPlayCircle,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { EscapeRoomStages } from '@lib/escapeRoomStages'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import EscapeRoomStageTracker, {
  ESCAPE_ROOM_FRAME as FRAME,
} from './EscapeRoomStageTracker'

// Minimal structural view of an EscapeRoomAttempt as selected by the
// participant-facing fragments — enough to derive the completion stats.
interface EscapeRoomAttemptStats {
  startedAt?: string | null
  completedAt?: string | null
  penaltySeconds?: number | null
  hintsUsed?: unknown | null
}

interface EscapeRoomOverlayProps {
  isStarted: boolean
  isCompleted: boolean
  isExpired: boolean
  remainingSeconds: number | null
  timeLimit: number // in seconds
  hintPenalty: number // in seconds
  onStart: () => Promise<void>
  loading?: boolean
  attempt?: EscapeRoomAttemptStats | null
  // stage counts and per-stage states from the mode's stage adapter
  stages?: EscapeRoomStages
  // lecturer-authored story shown on the start screen instead of the
  // generic mode description (markdown supported)
  introText?: string | null
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

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export default function EscapeRoomOverlay({
  isStarted,
  isCompleted,
  isExpired,
  remainingSeconds,
  timeLimit,
  hintPenalty,
  onStart,
  loading = false,
  attempt,
  stages,
  introText,
  bonus,
}: EscapeRoomOverlayProps) {
  const t = useTranslations()

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
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pwa.practiceQuiz.escapeRoomStartTitle')}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-white backdrop-blur-sm"
      >
        <div className="animate-fade-in flex w-full max-w-md flex-col items-center space-y-6 rounded-xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
          <div className="bg-primary flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white">
            <FontAwesomeIcon icon={faPlayCircle} />
          </div>
          <H3 className={{ root: 'text-2xl font-bold text-white' }}>
            {t('pwa.practiceQuiz.escapeRoomStartTitle')}
          </H3>
          {introText ? (
            <div
              className="prose prose-sm prose-invert max-h-56 w-full overflow-y-auto text-left leading-relaxed text-slate-300"
              data-cy="escape-room-intro-text-display"
            >
              <DynamicMarkdown content={introText} />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">
              {t('pwa.practiceQuiz.escapeRoomStartDesc')}
            </p>
          )}
          <div className="w-full space-y-2 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-left text-xs">
            {typeof totalStacks === 'number' && totalStacks > 0 && (
              <StatRow
                label={t('pwa.practiceQuiz.escapeRoomStagesLabel')}
                value={t('pwa.practiceQuiz.escapeRoomStageCount', {
                  required: stages?.requiredCount ?? 0,
                  bonus: stages?.bonusCount ?? 0,
                })}
              />
            )}
            <StatRow
              label={t('pwa.practiceQuiz.escapeRoomTimeLimitLabel')}
              value={`${Math.round(timeLimit / 60)} min`}
            />
            {hintPenalty > 0 && (
              <StatRow
                label={t('pwa.practiceQuiz.escapeRoomPenaltyLabel')}
                value={<span className="text-amber-400">+{hintPenalty}s</span>}
              />
            )}
          </div>
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
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pwa.practiceQuiz.escapeRoomExpiredTitle')}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-white backdrop-blur-sm"
      >
        <div className="animate-fade-in flex w-full max-w-md flex-col items-center space-y-6 rounded-xl border border-red-900/50 bg-slate-800 p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white">
            <FontAwesomeIcon icon={faHourglassEnd} />
          </div>
          <H3 className={{ root: 'text-2xl font-bold text-red-400' }}>
            {t('pwa.practiceQuiz.escapeRoomExpiredTitle')}
          </H3>
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
          <p className="text-xs leading-relaxed text-slate-400">
            {t('pwa.practiceQuiz.escapeRoomContactLecturer')}
          </p>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pwa.practiceQuiz.escapeRoomCompletedTitle')}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-white backdrop-blur-sm"
      >
        <div className="animate-fade-in flex w-full max-w-md flex-col items-center space-y-6 rounded-xl border border-green-900/50 bg-slate-800 p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-3xl text-white">
            <FontAwesomeIcon icon={faTrophy} />
          </div>
          <H3 className={{ root: 'text-2xl font-bold text-green-400' }}>
            {t('pwa.practiceQuiz.escapeRoomCompletedTitle')}
          </H3>
          <p className="text-sm leading-relaxed text-slate-300">
            {t('pwa.practiceQuiz.escapeRoomCompletedDesc')}
          </p>
          {bonus?.available && bonus.onStart && (
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
                    seconds: bonus.seconds,
                  })}
                </Button.Label>
              </Button>
            </div>
          )}
          {bonus?.outcome && (
            <p
              className="text-sm font-semibold text-amber-400"
              data-cy="escape-room-bonus-result"
            >
              {bonus.outcome === 'BONUS_CORRECT'
                ? t('pwa.practiceQuiz.escapeRoomBonusCorrect', {
                    seconds: bonus.seconds,
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
              {escapeSeconds !== null && (
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
            </div>
          )}
        </div>
      </div>
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
        FRAME.bar
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
