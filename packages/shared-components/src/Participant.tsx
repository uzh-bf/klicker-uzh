import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import type { KeyboardEvent, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

// medal-styled rank badges for the top three positions
const rankMedalStyles: Record<number, string> = {
  1: 'bg-amber-100 text-amber-600 ring-amber-300',
  2: 'bg-slate-200 text-slate-500 ring-slate-400',
  3: 'bg-orange-100 text-orange-700 ring-orange-300',
}

interface ParticipantProps {
  avatar?: string | null
  withAvatar?: boolean
  isTemporary?: boolean | null
  pseudonym?: string
  points?: number
  rank?: number | string
  isHighlighted?: boolean
  onClick?: () => void
  level?: number | null
  className?: string
}

function Participant({
  avatar,
  withAvatar = true,
  isTemporary = false,
  pseudonym,
  isHighlighted,
  onClick,
  children,
  className,
  points,
  rank,
  level,
}: PropsWithChildren<ParticipantProps>) {
  const t = useTranslations()
  const isInteractive = typeof onClick !== 'undefined'
  const medalStyle =
    typeof rank === 'number' ? rankMedalStyles[rank] : undefined

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick?.()
    }
  }

  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-1 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-1.5 shadow-sm transition-colors',
        isHighlighted &&
          'border-primary/40 border-l-4 border-l-primary bg-primary-20/60',
        isInteractive &&
          'cursor-pointer hover:border-slate-300 hover:bg-slate-50',
        className
      )}
      onClick={onClick}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={t('shared.leaderboard.entryAriaLabel', {
        rank: rank ?? '-',
        name: pseudonym ?? '',
        points: points ?? 0,
      })}
      data-cy={`leaderboard-entry-${pseudonym}`}
    >
      <div className="flex flex-1 flex-row items-center gap-2">
        {typeof rank !== 'undefined' && (
          <div className="flex w-7 shrink-0 justify-center">
            {medalStyle ? (
              <div
                className={twMerge(
                  'flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ring-1 ring-inset',
                  medalStyle
                )}
              >
                {rank}
              </div>
            ) : (
              <div className="text-base font-bold text-slate-400">{rank}</div>
            )}
          </div>
        )}
        {withAvatar && (
          <div className="relative flex w-[30px] shrink-0 justify-center">
            <Image
              src={
                typeof avatar !== 'undefined' && avatar !== null
                  ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
                  : '/user-solid.svg'
              }
              alt=""
              height={avatar ? 25 : 20}
              width={avatar ? 30 : 20}
            />
            {level && (
              <div className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-solid border-slate-300 bg-white text-[10px] font-bold text-slate-600 shadow-sm">
                {level}
              </div>
            )}
          </div>
        )}
        <div className="truncate font-medium text-slate-800 first:ml-2">
          {isTemporary && pseudonym
            ? `${pseudonym}*`
            : (pseudonym ?? t('shared.generic.free'))}
        </div>
        <div className="flex-1 text-right">{children}</div>
      </div>
      {typeof points === 'number' && (
        <div
          className={twMerge(
            'flex w-12 shrink-0 items-center justify-center rounded-full bg-slate-700 px-2 py-0.5 text-sm font-bold tabular-nums text-white',
            isHighlighted && 'bg-primary'
          )}
        >
          {points}
        </div>
      )}
    </div>
  )
}

export function ParticipantOther(props: ParticipantProps) {
  return <Participant {...props}></Participant>
}

interface ParticipantSelfProps extends ParticipantProps {
  isActive: boolean
  onJoinLeaderboard?: () => void
  onLeaveLeaderboard?: () => void
}

export function ParticipantSelf(props: ParticipantSelfProps) {
  const t = useTranslations()

  return (
    <Participant isHighlighted {...props}>
      {props.isActive && typeof props.onLeaveLeaderboard !== 'undefined' && (
        <Button
          className={{ root: 'h-7 text-sm' }}
          onClick={(e) => {
            e?.stopPropagation()
            props?.onLeaveLeaderboard?.()
          }}
          data={{ cy: 'leave-leaderboard' }}
        >
          <Button.Label>{t('shared.generic.leave')}</Button.Label>
        </Button>
      )}
      {!props.isActive && typeof props.onJoinLeaderboard !== 'undefined' && (
        <Button
          className={{ root: 'h-7 text-sm' }}
          onClick={(e) => {
            e?.stopPropagation()
            props.onJoinLeaderboard!()
          }}
          data={{ cy: 'join-leaderboard' }}
        >
          <Button.Label>{t('shared.generic.join')}</Button.Label>
        </Button>
      )}
    </Participant>
  )
}
