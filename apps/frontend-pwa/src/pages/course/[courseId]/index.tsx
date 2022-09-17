import { useMutation } from '@apollo/client'
import {
  JoinCourseDocument,
  LeaveCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import Image from 'next/future/image'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

import Layout from '@components/Layout'
import { addApolloState } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'

const PLACEHOLDER_IMG =
  'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/placeholder.png'

interface ParticipantProps {
  avatar?: string
  pseudonym: string
  points?: number
  isHighlighted?: boolean
  className?: string
}

function Participant({
  avatar,
  pseudonym,
  isHighlighted,
  children,
  className,
}: PropsWithChildren<ParticipantProps>) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-4 p-1 border rounded',
        isHighlighted && 'bg-uzh-grey-20',
        className
      )}
    >
      <div className="bg-white border rounded-full">
        <Image
          className="rounded-full"
          src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`}
          alt=""
          height={30}
          width={30}
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
    <Layout displayName="Leaderboard" courseName={course.displayName} courseColor={course.color}>
      <div className="md:m-auto md:max-w-6xl md:p-8 md:border md:rounded">
      <div className="space-y-2">
        <div className="flex flex-col gap-4 md:items-end md:flex-row">
          <div className="flex-1 order-2 h-28 md:border-b-2 md:order-1 bg-uzh-grey-20 md:border-uzh-blue-100">
            <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
              2.
            </div>
            <ParticipantOther
              className="bg-white shadow border-uzh-red-100"
              pseudonym={participant?.username}
              avatar={participant?.avatar}
              points={participation?.points}
            />
          </div>
          <div className="flex-1 order-1 h-32 md:border-b-2 md:order-2 bg-uzh-grey-20 md:border-uzh-blue-100">
            <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
              1.
            </div>
            <ParticipantOther
              className="bg-white shadow border-uzh-red-100"
              pseudonym={participant?.username}
              avatar={participant?.avatar}
              points={participation?.points}
            />
          </div>
          <div className="flex-1 order-3 h-24 md:border-b-2 bg-uzh-grey-20 md:border-uzh-blue-100">
            <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
              3.
            </div>
            <ParticipantOther
              className="bg-white shadow border-uzh-red-100"
              pseudonym={participant?.username}
              avatar={participant?.avatar}
              points={participation?.points}
            />
          </div>
        </div>

        <div className="pt-8 space-y-2">
          <ParticipantOther
            pseudonym={participant?.username}
            avatar={participant?.avatar}
            points={participation?.points}
          />
          <ParticipantOther
            pseudonym={participant?.username}
            avatar={participant?.avatar}
            points={participation?.points}
          />
          <ParticipantSelf
            isActive={participation?.isActive}
            pseudonym={participant?.username}
            avatar={participant?.avatar}
            points={participation?.points}
            onJoinCourse={joinCourse}
            onLeaveCourse={leaveCourse}
          />
          <ParticipantOther
            pseudonym={participant?.username}
            avatar={participant?.avatar}
            points={participation?.points}
          />
        </div>
      </div>
      </div>

    </Layout>
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
