import { Button } from '@uzh-bf/design-system'
import Image from 'next/future/image'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

interface ParticipantProps {
  avatar?: string | null
  withAvatar?: boolean
  pseudonym: string
  points?: number
  rank?: number
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
        'flex flex-row items-center gap-4 outline outline-slate-200 outline-1 rounded',
        isHighlighted && 'bg-uzh-grey-20',
        className
      )}
    >
      <div className="flex flex-row items-center flex-1 gap-4 p-1">
        {withAvatar && (
          <div className="bg-white border rounded-full border-slate-400">
            <Image
              className="rounded-full"
              src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`}
              alt=""
              height={27}
              width={27}
            />
          </div>
        )}

        {rank && <div className="text-lg font-bold">{rank}</div>}
        <div className="first:ml-1">{pseudonym ?? 'Frei'}</div>
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
        <Button className="text-sm" onClick={() => props.onLeaveCourse()}>
          Austreten
        </Button>
      ) : (
        <Button
          className="text-sm"
          onClick={props.onJoinCourse ? () => props.onJoinCourse() : undefined}
        >
          Beitreten
        </Button>
      )}
    </Participant>
  )
}
