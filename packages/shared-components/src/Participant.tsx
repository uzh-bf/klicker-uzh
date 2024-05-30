import React from 'react'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface ParticipantProps {
  avatar?: string | null
  withAvatar?: boolean
  pseudonym?: string
  points?: number
  rank?: number | string
  isHighlighted?: boolean
  onClick?: () => void
  level?: number
  className?: string
}

function Participant({
  avatar,
  withAvatar = true,
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
    <div
      className={twMerge(
        'flex flex-row items-center gap-1 rounded border border-slate-200',
        isHighlighted && 'bg-uzh-grey-20',
        onClick && 'hover:cursor-pointer hover:border-orange-200',
        className
      )}
      onClick={onClick}
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
              <div className="absolute bottom-0 right-0 -mb-1 flex h-3 w-3 items-center justify-center rounded-full border border-solid border-uzh-grey-80 bg-white text-xs font-bold text-slate-600">
                {level}
              </div>
            )}
          </div>
        )}
        <div className="text-slate-700 first:ml-2">
          {pseudonym ?? t('shared.generic.free')}
        </div>
        <div className="flex-1 text-right">{children}</div>
      </div>
      {typeof points === 'number' && (
        <div className="flex flex-initial flex-col items-end justify-center self-stretch rounded-r bg-slate-700 px-3 py-1 font-bold text-white">
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
  onJoinCourse?: () => void
  onLeaveCourse?: () => void
}

export function ParticipantSelf(props: ParticipantSelfProps) {
  const t = useTranslations()

  return (
    <Participant isHighlighted {...props}>
      {props.isActive && typeof props.onLeaveCourse !== 'undefined' && (
        <Button
          className={{ root: 'text-sm' }}
          onClick={(e) => {
            e?.stopPropagation()
            props?.onLeaveCourse?.()
          }}
          data={{ cy: 'leave-leaderboard' }}
        >
          {t('shared.generic.leave')}
        </Button>
      )}
      {!props.isActive && typeof props.onJoinCourse !== 'undefined' && (
        <Button
          className={{ root: 'text-sm' }}
          onClick={(e) => {
            e?.stopPropagation()
            props.onJoinCourse!()
          }}
          data={{ cy: 'join-leaderboard' }}
        >
          {t('shared.generic.join')}
        </Button>
      )}
    </Participant>
  )
}
