import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import type { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const participantInfo = (
    <>
      {rank && <span className="ml-1 w-3 text-lg font-bold">{rank}</span>}
      {withAvatar && (
        <span className="relative flex w-[30px] justify-center">
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
            <span className="border-uzh-grey-80 absolute bottom-0 right-0 -mb-1 flex h-3 w-3 items-center justify-center rounded-full border border-solid bg-white text-xs font-bold text-slate-600">
              {level}
            </span>
          )}
        </span>
      )}
      <span className="text-slate-700 first:ml-2">
        {isTemporary && pseudonym
          ? `${pseudonym}*`
          : (pseudonym ?? t('shared.generic.free'))}
      </span>
    </>
  )
  const participantDataCy = `leaderboard-entry-${pseudonym}`

  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-1 rounded border border-slate-200',
        isHighlighted && 'bg-uzh-grey-20',
        onClick && 'hover:border-orange-200',
        className
      )}
      data-cy={onClick ? undefined : participantDataCy}
    >
      {onClick ? (
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-row items-center gap-2 text-left hover:cursor-pointer"
          onClick={onClick}
          data-cy={participantDataCy}
        >
          {participantInfo}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-row items-center gap-2">
          {participantInfo}
        </div>
      )}
      {children ? (
        <div className="flex flex-row items-center text-right">{children}</div>
      ) : null}
      {typeof points === 'number' && (
        <div className="flex flex-initial flex-col items-end justify-center self-stretch rounded-r-lg bg-slate-700 px-3 py-1 font-bold text-white">
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
