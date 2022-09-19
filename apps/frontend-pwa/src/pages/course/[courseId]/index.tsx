import { useMutation, useQuery } from '@apollo/client'
import {
  GetCourseOverviewDataDocument,
  JoinCourseDocument,
  LeaveCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import getConfig from 'next/config'
import Image from 'next/future/image'
import { PropsWithChildren, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import Layout from '@components/Layout'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'

const { serverRuntimeConfig } = getConfig()

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
  points,
}: PropsWithChildren<ParticipantProps>) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-4 outline outline-slate-300 outline-1 rounded',
        isHighlighted && 'bg-uzh-grey-20',
        className
      )}
    >
      <div className="flex flex-row items-center flex-1 gap-4 p-1">
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
      <div className="flex flex-col items-center self-stretch justify-center flex-initial px-3 py-1 font-bold text-white bg-slate-700">
        {points}
      </div>
    </div>
  )
}

function ParticipantOther(props: ParticipantProps) {
  return <Participant {...props}></Participant>
}

interface ParticipantSelfProps extends ParticipantProps {
  isActive: boolean
  onJoinCourse: () => void
  onLeaveCourse: () => void
}

function ParticipantSelf(props: ParticipantSelfProps) {
  return (
    <Participant isHighlighted {...props}>
      {props.isActive ? (
        <Button className="text-sm" onClick={() => props.onLeaveCourse()}>
          Austreten
        </Button>
      ) : (
        <Button className="text-sm" onClick={() => props.onJoinCourse()}>
          Beitreten
        </Button>
      )}
    </Participant>
  )
}

function CourseOverview({ courseId }: any) {
  const { data, loading, error } = useQuery(GetCourseOverviewDataDocument, {
    variables: { courseId },
  })

  const [joinCourse] = useMutation(JoinCourseDocument, {
    variables: { courseId },
    refetchQueries: [
      { query: GetCourseOverviewDataDocument, variables: { courseId } },
    ],
  })

  const [leaveCourse] = useMutation(LeaveCourseDocument, {
    variables: { courseId },
    refetchQueries: [
      { query: GetCourseOverviewDataDocument, variables: { courseId } },
    ],
  })

  const { rank1, rank2, rank3 } = useMemo(() => {
    if (!data?.getCourseOverviewData?.leaderboard) return {}
    return {
      rank1:
        data.getCourseOverviewData.leaderboard.length >= 1 &&
        data.getCourseOverviewData.leaderboard[0],
      rank2:
        data.getCourseOverviewData.leaderboard.length >= 2 &&
        data.getCourseOverviewData.leaderboard[1],
      rank3:
        data.getCourseOverviewData.leaderboard.length >= 3 &&
        data.getCourseOverviewData.leaderboard[2],
    }
  }, [data?.getCourseOverviewData?.leaderboard])

  if (!data?.getCourseOverviewData || loading) return <div>Loading...</div>
  if (error) return <p>Oh no... {error.message}</p>

  const { course, participant, participation, leaderboard } =
    data.getCourseOverviewData

  return (
    <Layout
      displayName="Leaderboard"
      courseName={course.displayName}
      courseColor={course.color}
    >
      <div className="md:m-auto md:max-w-3xl md:p-8 md:w-full md:border md:rounded">
        <div className="space-y-2">
          <div className="flex flex-col gap-4 md:items-end md:flex-row">
            <div className="flex-1 order-2 h-28 md:border-b-2 md:order-1 bg-uzh-grey-20 md:border-uzh-blue-100">
              <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
                2. {rank2.isSelf && 'bist du!'}
              </div>
              <ParticipantOther
                className="bg-white shadow outline-uzh-red-100"
                pseudonym={rank2.username ?? 'Frei'}
                avatar={rank2.avatar ?? 'placeholder'}
                points={rank2.score ?? 0}
              />
            </div>

            <div className="flex-1 order-1 h-32 md:border-b-2 md:order-2 bg-uzh-grey-20 md:border-uzh-blue-100">
              <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
                1. {rank1.isSelf && 'bist du!'}
              </div>
              <ParticipantOther
                className="bg-white shadow outline-uzh-red-100"
                pseudonym={rank1.username ?? 'Frei'}
                avatar={rank1.avatar ?? 'placeholder'}
                points={rank1.score ?? 0}
              />
            </div>

            <div className="flex-1 order-3 h-24 md:border-b-2 bg-uzh-grey-20 md:border-uzh-blue-100">
              <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
                3. {rank3.isSelf && 'bist du!'}
              </div>
              <ParticipantOther
                className="bg-white shadow outline-uzh-red-100"
                pseudonym={rank3.username ?? 'Frei'}
                avatar={rank3.avatar ?? 'placeholder'}
                points={rank3.score ?? 0}
              />
            </div>
          </div>

          <div className="pt-8 space-y-2">
            {!participation?.isActive && (
              <ParticipantSelf
                key={participant?.id}
                isActive={false}
                pseudonym={participant?.username}
                avatar={participant?.avatar}
                points={0}
                onJoinCourse={joinCourse}
                onLeaveCourse={leaveCourse}
              />
            )}
            {leaderboard?.map((entry) => {
              if (entry.isSelf) {
                return (
                  <ParticipantSelf
                    key={entry.id}
                    isActive={participation?.isActive ?? false}
                    pseudonym={entry.username}
                    avatar={entry.avatar}
                    points={entry.score}
                    onJoinCourse={joinCourse}
                    onLeaveCourse={leaveCourse}
                  />
                )
              }

              return (
                <ParticipantOther
                  key={entry.id}
                  pseudonym={entry.username}
                  avatar={entry.avatar}
                  points={entry.score}
                />
              )
            })}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (participant && !participant.avatar) {
    return {
      redirect: {
        destination: `/editProfile?redirect_to=${encodeURIComponent(
          `/course/${ctx.params.courseId}`
        )}`,
        statusCode: 302,
      },
    }
  }

  const result = await apolloClient.query({
    query: GetCourseOverviewDataDocument,
    variables: {
      courseId: ctx.params.courseId as string,
    },
    context: participantToken
      ? {
          headers: {
            authorization: `Bearer ${participantToken}`,
          },
        }
      : undefined,
  })

  if (!result.data.getCourseOverviewData) {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      courseId: ctx.params.courseId,
    },
  })
}

export default CourseOverview
