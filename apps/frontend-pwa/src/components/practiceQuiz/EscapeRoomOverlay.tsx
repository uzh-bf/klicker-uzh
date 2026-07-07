import {
  faClock,
  faHourglassEnd,
  faPlayCircle,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface EscapeRoomOverlayProps {
  isStarted: boolean
  isCompleted: boolean
  isExpired: boolean
  remainingSeconds: number | null
  timeLimit: number // in seconds
  hintPenalty: number // in seconds
  onStart: () => Promise<void>
  onReset?: () => Promise<void>
  loading?: boolean
}

export default function EscapeRoomOverlay({
  isStarted,
  isCompleted,
  isExpired,
  remainingSeconds,
  timeLimit,
  hintPenalty,
  onStart,
  onReset,
  loading = false,
}: EscapeRoomOverlayProps) {
  const t = useTranslations()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Full page block overlays for start, completed, expired states
  if (!isStarted) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-white backdrop-blur-sm">
        <div className="animate-fade-in flex w-full max-w-md flex-col items-center space-y-6 rounded-xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
          <div className="bg-primary flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white">
            <FontAwesomeIcon icon={faPlayCircle} />
          </div>
          <H3 className={{ root: 'text-2xl font-bold text-white' }}>
            {t('pwa.practiceQuiz.escapeRoomStartTitle' as any, {
              defaultValue: 'Escape Room Mode',
            })}
          </H3>
          <p className="text-sm leading-relaxed text-slate-300">
            {t('pwa.practiceQuiz.escapeRoomStartDesc' as any, {
              defaultValue:
                'Unlock questions sequentially by answering correctly before the timer runs out!',
            })}
          </p>
          <div className="bg-slate-750 w-full space-y-2 rounded-lg border border-slate-700 p-4 text-left text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">
                {t('pwa.practiceQuiz.escapeRoomTimeLimitLabel' as any, {
                  defaultValue: 'Time Limit',
                })}
                :
              </span>
              <span className="font-semibold">
                {Math.round(timeLimit / 60)} min
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {t('pwa.practiceQuiz.escapeRoomPenaltyLabel' as any, {
                  defaultValue: 'Hint Penalty',
                })}
                :
              </span>
              <span className="font-semibold text-amber-400">
                +{hintPenalty}s
              </span>
            </div>
          </div>
          <Button
            primary
            disabled={loading}
            className={{ root: 'h-11 w-full text-lg font-bold' }}
            onClick={onStart}
          >
            <Button.Label>
              {loading
                ? t('shared.generic.loading' as any)
                : t('pwa.practiceQuiz.escapeRoomStartButton' as any, {
                    defaultValue: 'Start Attempt',
                  })}
            </Button.Label>
          </Button>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-white backdrop-blur-sm">
        <div className="flex w-full max-w-md flex-col items-center space-y-6 rounded-xl border border-red-900/50 bg-slate-800 p-8 text-center shadow-2xl">
          <div className="bg-red-650 flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white">
            <FontAwesomeIcon icon={faHourglassEnd} />
          </div>
          <H3 className={{ root: 'text-2xl font-bold text-red-400' }}>
            {t('pwa.practiceQuiz.escapeRoomExpiredTitle' as any, {
              defaultValue: "Time's Up!",
            })}
          </H3>
          <p className="text-sm leading-relaxed text-slate-300">
            {t('pwa.practiceQuiz.escapeRoomExpiredDesc' as any, {
              defaultValue: 'You ran out of time! This attempt has expired.',
            })}
          </p>
          {onReset && (
            <Button
              basic
              disabled={loading}
              className={{
                root: 'h-10 w-full text-sm font-semibold hover:bg-slate-700',
              }}
              onClick={onReset}
            >
              <Button.Label>
                {t('pwa.practiceQuiz.escapeRoomResetButton' as any, {
                  defaultValue: 'Restart Escape Room',
                })}
              </Button.Label>
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-white backdrop-blur-sm">
        <div className="flex w-full max-w-md flex-col items-center space-y-6 rounded-xl border border-green-900/50 bg-slate-800 p-8 text-center shadow-2xl">
          <div className="bg-green-650 flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white">
            <FontAwesomeIcon icon={faTrophy} />
          </div>
          <H3 className={{ root: 'text-2xl font-bold text-green-400' }}>
            {t('pwa.practiceQuiz.escapeRoomCompletedTitle' as any, {
              defaultValue: 'Escaped successfully!',
            })}
          </H3>
          <p className="text-sm leading-relaxed text-slate-300">
            {t('pwa.practiceQuiz.escapeRoomCompletedDesc' as any, {
              defaultValue:
                'Congratulations! You answered all questions correctly and completed the escape room.',
            })}
          </p>
          {onReset && (
            <Button
              basic
              disabled={loading}
              className={{
                root: 'h-10 w-full text-sm font-semibold hover:bg-slate-700',
              }}
              onClick={onReset}
            >
              <Button.Label>
                {t('pwa.practiceQuiz.escapeRoomResetButton' as any, {
                  defaultValue: 'Restart Escape Room',
                })}
              </Button.Label>
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Active in-progress state: Render the sticky timer banner/bar
  return (
    <div className="sticky top-0 z-[50] flex w-full items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-2 text-white shadow-md">
      <div className="flex items-center space-x-2 space-y-0 text-sm text-slate-300">
        <span className="font-semibold text-white">
          {t('pwa.practiceQuiz.escapeRoomTitle' as any, {
            defaultValue: 'Escape Room',
          })}
        </span>
      </div>
      <div className="flex items-center space-x-2 rounded border border-slate-700 bg-slate-800 px-3 py-1 font-mono text-base font-bold tracking-wider text-amber-400">
        <FontAwesomeIcon icon={faClock} className="text-slate-400" />
        <span>
          {remainingSeconds !== null ? formatTime(remainingSeconds) : '00:00'}
        </span>
      </div>
    </div>
  )
}
