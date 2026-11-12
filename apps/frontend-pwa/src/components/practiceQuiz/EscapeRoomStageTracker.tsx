import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faEye,
  faForward,
  faLock,
  faLockOpen,
  faStar,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type {
  EscapeRoomStageState,
  EscapeRoomStageView,
} from '@lib/escapeRoomStages'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

// Colours of the Escape Room frame (dark bar and dialogs), defined once so the
// header, the stage tracker and the dialogs stay consistent.
export const ESCAPE_ROOM_FRAME = {
  bar: 'border-slate-700 bg-slate-900 text-white',
  panel: 'border-slate-700 bg-slate-800',
  chip: 'border-slate-700 bg-slate-800 text-slate-300',
  muted: 'text-slate-400',
  ok: 'text-green-400',
  warn: 'text-amber-400',
  danger: 'text-red-400',
  dangerBorder: 'border-red-500',
  marker: 'border-slate-600 bg-slate-800',
  ring: 'ring-2 ring-sky-400',
} as const

const FRAME = ESCAPE_ROOM_FRAME

// State is carried by the icon shape; colour only reinforces it.
const MARKERS: Record<
  EscapeRoomStageState,
  { icon: IconDefinition; className: string }
> = {
  open: { icon: faLock, className: FRAME.muted },
  current: { icon: faLock, className: twMerge('text-white', FRAME.ring) },
  solved: { icon: faLockOpen, className: FRAME.ok },
  revealed: { icon: faEye, className: FRAME.warn },
  skipped: { icon: faForward, className: 'text-slate-300' },
  bonusCorrect: { icon: faStar, className: FRAME.warn },
  bonusWrong: {
    icon: faXmark,
    className: twMerge(FRAME.danger, 'border-dashed border-red-400'),
  },
}

// Bonus stages only reach open, current, correct or wrong; a bonus stage in
// any other state is shown as open.
const BONUS_STAR: Partial<Record<EscapeRoomStageState, string>> = {
  current: FRAME.ring,
}

// Translator accepted by the helpers below; the bivariant method signature lets
// the typed next-intl translator be passed with dynamically built keys.
export type EscapeRoomTranslate = {
  bivarianceHack(key: string, values?: Record<string, string | number>): string
}['bivarianceHack']

// Marker icon, colour classes and accessible label of one stage; shared with
// the stage recap of the ending dialogs.
export function getEscapeRoomStageMarker(
  stage: EscapeRoomStageView,
  t: EscapeRoomTranslate
) {
  const isBonus = stage.kind === 'bonus'
  const isBonusResult =
    stage.state === 'bonusCorrect' || stage.state === 'bonusWrong'
  const marker =
    isBonus && !isBonusResult
      ? {
          icon: faStar,
          className: twMerge(FRAME.muted, BONUS_STAR[stage.state]),
        }
      : MARKERS[stage.state]
  const label = isBonus
    ? t(
        `pwa.practiceQuiz.escapeRoomStageBonus${
          stage.state === 'bonusCorrect'
            ? 'Correct'
            : stage.state === 'bonusWrong'
              ? 'Wrong'
              : stage.state === 'current'
                ? 'Current'
                : 'Open'
        }`
      )
    : t(
        `pwa.practiceQuiz.escapeRoomStage${
          stage.state === 'current'
            ? 'Current'
            : stage.state === 'solved'
              ? 'Solved'
              : stage.state === 'revealed'
                ? 'Revealed'
                : stage.state === 'skipped'
                  ? 'Skipped'
                  : 'Open'
        }`,
        { number: stage.index + 1 }
      )
  return { ...marker, label }
}

interface EscapeRoomStageTrackerProps {
  stages: EscapeRoomStageView[]
  className?: string
}

export default function EscapeRoomStageTracker({
  stages,
  className,
}: EscapeRoomStageTrackerProps) {
  const t = useTranslations()

  return (
    <ol
      aria-label={t('pwa.practiceQuiz.escapeRoomStagesLabel')}
      className={twMerge('flex items-center gap-1', className)}
      data-cy="escape-room-stage-tracker"
    >
      {stages.map((stage) => {
        const marker = getEscapeRoomStageMarker(stage, t)

        return (
          <li
            key={stage.index}
            aria-label={marker.label}
            aria-current={stage.state === 'current' ? 'step' : undefined}
            data-cy="escape-room-stage-marker"
            data-state={stage.state}
            data-kind={stage.kind}
            className={twMerge(
              'flex flex-none items-center justify-center rounded-full border',
              FRAME.marker,
              'h-5 w-5 text-[10px]',
              marker.className
            )}
          >
            <FontAwesomeIcon icon={marker.icon} aria-hidden="true" />
          </li>
        )
      })}
    </ol>
  )
}
