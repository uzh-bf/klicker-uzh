import { Button } from '@uzh-bf/design-system'
import Image from 'next/image'
import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface ParticipantProps {
  avatar?: string | null
  withAvatar?: boolean
  pseudonym?: string
  points?: number
  rank?: number | string
  isHighlighted?: boolean
  className?: string
}

function Participant({
  avatar,
  withAvatar,
  pseudonym,
  isHighlighted,
  children,
  className,
  points,
  rank,
}: PropsWithChildren<ParticipantProps>) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-1 border border-slate-200 rounded',
        isHighlighted && 'bg-uzh-grey-20',
        className
      )}
    >
      <div className="flex flex-row items-center flex-1 gap-2">
        {rank && <div className="w-3 ml-1 text-lg font-bold">{rank}</div>}

        {withAvatar && (
          <div className="w-[30px] h-full">
            <Image
              src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`}
              alt=""
              height={25}
              width={30}
            />
          </div>
        )}

        <div className="first:ml-2 text-slate-700">{pseudonym ?? 'Frei'}</div>
        <div className="flex-1 text-right">{children}</div>
      </div>
      {typeof points === 'number' && (
        <div className="flex flex-col items-end self-stretch justify-center flex-initial px-3 py-1 font-bold text-white rounded-r bg-slate-700">
          {points}
        </div>
      )}
    </div>
  )
}

Participant.defaultProps = {
  withAvatar: true,
}

export function ParticipantOther(props: ParticipantProps) {
  return <Participant {...props}></Participant>
}

interface ParticipantSelfProps extends ParticipantProps {
  isActive: boolean
  onJoinCourse?: () => void
  onLeaveCourse: () => void
}

export function ParticipantSelf(props: ParticipantSelfProps) {
  return (
    <Participant isHighlighted {...props}>
      {props.isActive ? (
        <Button
          className={{ root: 'text-sm' }}
          onClick={() => props.onLeaveCourse()}
        >
          Austreten
        </Button>
      ) : (
        <Button
          className={{ root: 'text-sm' }}
          onClick={props.onJoinCourse ? () => props.onJoinCourse!() : undefined}
        >
          Beitreten
        </Button>
      )}
    </Participant>
  )
}
