import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import type { KeyboardEvent, PropsWithChildren } from 'react'
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

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Clickable leaderboard rows can contain nested join/leave buttons, so a native button would be invalid. */}
      {/* biome-ignore lint/a11y/useSemanticElements: Clickable leaderboard rows can contain nested join/leave buttons, so a native button would be invalid. */}
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={twMerge(
          'flex flex-row items-center gap-1 rounded border border-slate-200',
          isHighlighted && 'bg-uzh-grey-20',
          onClick && 'hover:cursor-pointer hover:border-orange-200',
          className
        )}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (event: KeyboardEvent<HTMLDivElement>) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault()
                  onClick()
                }
              }
            : undefined
        }
        data-cy={`leaderboard-entry-${pseudonym}`}
      >
        <div className="flex flex-1 flex-row items-center gap-2">
          {rank && <div className="ml-1 w-3 text-lg font-bold">{rank}</div>}
          {withAvatar && (
            <div className="relative flex w-[30px] justify-center">
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
                <div className="border-uzh-grey-80 absolute bottom-0 right-0 -mb-1 flex h-3 w-3 items-center justify-center rounded-full border border-solid bg-white text-xs font-bold text-slate-600">
                  {level}
                </div>
              )}
            </div>
          )}
          <div className="text-slate-700 first:ml-2">
            {isTemporary && pseudonym
              ? `${pseudonym}*`
              : (pseudonym ?? t('shared.generic.free'))}
          </div>
          <div className="flex-1 text-right">{children}</div>
        </div>
        {typeof points === 'number' && (
          <div className="flex flex-initial flex-col items-end justify-center self-stretch rounded-r-lg bg-slate-700 px-3 py-1 font-bold text-white">
            {points}
          </div>
        )}
      </div>
    </>
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
