import { useMutation } from '@apollo/client'
import {
  JoinCourseDocument,
  LeaveCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

import { addApolloState } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'

const PLACEHOLDER_IMG =
  'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/placeholder.png'

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
          src={avatar || PLACEHOLDER_IMG}
          alt="Participant Avatar"
          layout="fill"
        />
      </div>
      <div>{pseudonym}</div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function ParticipantOther(props: ParticipantProps) {
  return (
    <Participant {...props}>
      <div>Points: {props.points}</div>
    </Participant>
  )
}

interface ParticipantSelfProps extends ParticipantProps {
  isActive: boolean
  onJoinCourse: () => void
  onLeaveCourse: () => void
}

function ParticipantSelf(props: ParticipantSelfProps) {
  return (
    <Participant isHighlighted {...props}>
      <div className="flex flex-row items-center justify-between">
        <div>Points: {props.points}</div>
        <div>
          {props.isActive ? (
            <Button className="text-sm" onClick={() => props.onLeaveCourse()}>
              Leave course
            </Button>
          ) : (
            <Button className="text-sm" onClick={() => props.onJoinCourse()}>
              Join course
            </Button>
          )}
        </div>
      </div>
    </Participant>
  )
}

function CourseOverview({ course, participation, participant }: any) {
  const [joinCourse] = useMutation(JoinCourseDocument, {
    variables: { courseId: course.id },
  })
  const [leaveCourse] = useMutation(LeaveCourseDocument, {
    variables: { courseId: course.id },
  })

  return (
    <div className="">
      <div className="flex flex-row items-center justify-between px-4 py-2 text-white bg-uzh-blue-100">
        <div className="">{course.name}</div>
        <div className="relative w-auto h-8 aspect-square">
          <Image
            className="rounded-full"
            src={participant?.avatar || PLACEHOLDER_IMG}
            alt="Participant Avatar"
            layout="fill"
          />
        </div>
      </div>

      <div className="p-4 space-y-1">
        <ParticipantOther
          pseudonym={participant?.pseudonym}
          avatar={participant?.avatar}
          points={participation?.points}
        />
        <ParticipantSelf
          isActive={participation?.isActive}
          pseudonym={participant?.pseudonym}
          avatar={participant?.avatar}
          points={participation?.points}
          onJoinCourse={joinCourse}
          onLeaveCourse={leaveCourse}
        />
        <ParticipantOther
          pseudonym={participant?.pseudonym}
          avatar={participant?.avatar}
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
