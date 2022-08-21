import { GetServerSideProps } from 'next'
import Image from 'next/image'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

import PlaceholderIMG from '../../../public/avatars/placeholder.png'
import { addApolloState } from '../../lib/apollo'
import { getParticipantToken } from '../../lib/token'

interface ParticipantProps {
  avatar?: string
  pseudonym: string
  points?: number
  isHighlighted?: boolean
}

function Participant({
  avatar,
  pseudonym,
  isHighlighted,
  children,
}: PropsWithChildren<ParticipantProps>) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-4 p-1 border rounded',
        isHighlighted && 'bg-uzh-grey-20'
      )}
    >
      <div className="relative w-auto h-6 border rounded-full aspect-square">
        <Image
          className="rounded-full"
          src={avatar || PlaceholderIMG}
          alt="Participant Avatar"
          layout="fill"
        />
      </div>
      <div>{pseudonym}</div>
      <div>{children}</div>
    </div>
  )
}

function ParticipantOther(props: ParticipantProps) {
  return (
    <Participant {...props}>
      <div>{props.points}</div>
    </Participant>
  )
}

function ParticipantSelf(props: ParticipantProps) {
  return (
    <Participant isHighlighted {...props}>
      <div>{props.points ? props.points : 'Not participating. Join?'}</div>
    </Participant>
  )
}

function CourseOverview({ course, participation, participant }: any) {
  return (
    <div className="">
      <div className="flex flex-row items-center justify-between px-4 py-2 text-white bg-uzh-blue-100">
        <div className="">{course.name}</div>
        <div className="relative w-auto h-8 aspect-square">
          <Image
            className="rounded-full"
            src={participant.avatar || PlaceholderIMG}
            alt="Participant Avatar"
            layout="fill"
          />
        </div>
      </div>

      <div className="p-4 space-y-1">
        <ParticipantOther
          pseudonym={participant.pseudonym}
          avatar={participant.avatar}
          points={participation?.points}
        />
        <ParticipantSelf
          pseudonym={participant.pseudonym}
          avatar={participant.avatar}
          points={participation?.points}
        />
        <ParticipantOther
          pseudonym={participant.pseudonym}
          avatar={participant.avatar}
          points={participation?.points}
        />
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const withNewParticipantToken = await getParticipantToken(ctx)

  return addApolloState(withNewParticipantToken.apolloClient, {
    props: {
      ...withNewParticipantToken.result,
    },
  })
}

export default CourseOverview
