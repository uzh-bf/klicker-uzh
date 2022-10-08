import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  CreateParticipantGroupDocument,
  GetCourseOverviewDataDocument,
  GetParticipantGroupsDocument,
  JoinCourseDocument,
  JoinParticipantGroupDocument,
  LeaveCourseDocument,
  LeaveParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Button, H3 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { GetServerSideProps } from 'next'
import getConfig from 'next/config'
import Image from 'next/future/image'
import { any } from 'ramda'
import { PropsWithChildren, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const { serverRuntimeConfig } = getConfig()

function Podium({ rank1, rank2, rank3 }) {
  return (
    <div className="flex flex-col gap-4 md:items-end md:flex-row">
      <div className="flex-1 order-2 h-28 md:border-b-2 md:order-1 bg-uzh-grey-20 md:border-uzh-blue-100">
        <div className="text-2xl font-bold bg-white md:text-center text-uzh-red-100">
          2. {rank2.isSelf && 'bist du!'}
        </div>
        <ParticipantOther
          className="bg-white shadow outline-uzh-red-100"
          pseudonym={rank2.username ?? 'Frei'}
          avatar={rank2.avatar}
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
          avatar={rank1.avatar}
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
          avatar={rank3.avatar}
          points={rank3.score ?? 0}
        />
      </div>
    </div>
  )
}

interface ParticipantProps {
  avatar?: string
  pseudonym: string
  points?: number
  rank?: number
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
  rank,
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
            src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
              avatar ?? 'placeholder'
            }.svg`}
            alt=""
            height={30}
            width={30}
          />
        </div>
        {rank && <div className="text-lg font-bold">{rank}</div>}
        <div>{pseudonym}</div>
        <div className="flex-1 text-right">{children}</div>
      </div>
      {typeof points === 'number' && (
        <div className="flex flex-col items-center self-stretch justify-center flex-initial px-3 py-1 font-bold text-white bg-slate-700">
          {points}
        </div>
      )}
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

  console.log(data)

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

  const [createParticipantGroup] = useMutation(CreateParticipantGroupDocument)
  const [joinParticipantGroup] = useMutation(JoinParticipantGroupDocument)
  const [leaveParticipantGroup] = useMutation(LeaveParticipantGroupDocument)

  // TODO: move this computation to a component
  const { rank1, rank2, rank3, isSelfContained } = useMemo(() => {
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
      isSelfContained: any(
        (item) =>
          item.participantId === data.getCourseOverviewData?.participant?.id,
        data.getCourseOverviewData.leaderboard
      ),
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
      <div className="md:m-auto md:max-w-3xl md:w-full md:border md:rounded">
        <TabsPrimitive.Root defaultValue="global">
          <TabsPrimitive.Content
            key={`tab-content-course`}
            value="global"
            className={twMerge('rounded-t-lg bg-white px-6 py-4')}
          >
            <H3 className="flex flex-row justify-between">Kursleaderboard</H3>
            <Podium rank1={rank1} rank2={rank2} rank3={rank3} />
            <div className="pt-8 space-y-2">
              {leaderboard?.flatMap((entry) => {
                if (entry.isSelf) {
                  return (
                    <ParticipantSelf
                      key={entry.id}
                      isActive={participation?.isActive ?? false}
                      pseudonym={entry.username}
                      avatar={entry.avatar}
                      points={entry.score}
                      rank={entry.rank}
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
                    rank={entry.rank}
                    points={entry.score}
                  />
                )
              })}

              {(!participation?.isActive || !isSelfContained) && (
                <ParticipantSelf
                  key={participant?.id}
                  isActive={participation.isActive}
                  pseudonym={participant?.username}
                  avatar={participant?.avatar}
                  points={null}
                  onJoinCourse={joinCourse}
                  onLeaveCourse={leaveCourse}
                />
              )}
            </div>
            HISTOGRAMM
            <H3 className="flex flex-row justify-between">
              Gruppenleaderboard
            </H3>
          </TabsPrimitive.Content>

          {data.participantGroups?.map((group) => (
            <TabsPrimitive.Content
              key={`tab-content-${group.id}`}
              value={group.name}
              className={twMerge('rounded-t-lg bg-white px-6 py-4')}
            >
              <H3 className="flex flex-row justify-between">
                <div>{group.name}</div>
                <div>{group.code}</div>
              </H3>

              <Podium rank1={rank1} rank2={rank2} rank3={rank3} />

              <div className="pt-8 space-y-2">
                {group.participants?.flatMap((entry) => {
                  if (entry.isSelf) {
                    return (
                      <ParticipantSelf
                        key={entry.id}
                        isActive={participation?.isActive ?? false}
                        pseudonym={entry.username}
                        avatar={entry.avatar}
                        points={entry.score}
                        onJoinCourse={joinCourse}
                        onLeaveCourse={() =>
                          leaveParticipantGroup({
                            variables: {
                              courseId,
                              groupId: group.id,
                            },
                            refetchQueries: [GetCourseOverviewDataDocument],
                          })
                        }
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
            </TabsPrimitive.Content>
          ))}

          <TabsPrimitive.Content
            key={`tab-content-create`}
            value="create"
            className={twMerge('rounded-t-lg bg-white px-6 py-4')}
          >
            <H3>Gruppe erstellen</H3>
            <Formik
              initialValues={{ groupName: '' }}
              onSubmit={(values) =>
                createParticipantGroup({
                  variables: {
                    courseId: courseId,
                    name: values.groupName,
                  },
                  refetchQueries: [
                    {
                      query: GetParticipantGroupsDocument,
                      variables: { courseId: courseId },
                    },
                  ],
                })
              }
            >
              <Form>
                <div className="flex flex-row gap-4">
                  <Field
                    type="text"
                    name="groupName"
                    placeholder="Gruppenname"
                  />
                  <ErrorMessage
                    name="groupName"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <Button type="submit">Erstellen</Button>
                </div>
              </Form>
            </Formik>

            <H3 className="mt-4">Gruppe beitreten</H3>
            <Formik
              initialValues={{ code: '' }}
              onSubmit={async (values, actions) => {
                setTimeout(() => {
                  alert(JSON.stringify(values, null, 2))
                  actions.setSubmitting(false)
                }, 1000)

                const result = await joinParticipantGroup({
                  variables: {
                    courseId: courseId,
                    code: Number(values.code) >> 0,
                  },
                })
              }}
            >
              <Form>
                <div className="flex flex-row gap-4">
                  <Field type="text" name="code" placeholder="Code" />
                  <ErrorMessage
                    name="code"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <Button type="submit">Beitreten</Button>
                </div>
              </Form>
            </Formik>
          </TabsPrimitive.Content>

          <TabsPrimitive.List
            className={twMerge('flex w-full rounded-t-lg bg-white')}
          >
            <TabsPrimitive.Trigger
              key={`tab-trigger-course`}
              value="global"
              className={twMerge(
                'group',
                'first:rounded-bl-lg last:rounded-br-lg',
                'border-t first:border-r last:border-l',
                'border-gray-300',
                'rdx-state-active:border-b-gray-700 focus-visible:rdx-state-active:border-b-transparent rdx-state-inactive:bg-gray-50',
                'flex-1 px-3 py-2.5',
                'focus:rdx-state-active:border-t-red',
                'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75'
              )}
            >
              <span className={twMerge('text-sm font-medium', 'text-gray-700')}>
                Kursleaderboard
              </span>
            </TabsPrimitive.Trigger>

            {data.participantGroups?.map((group) => (
              <TabsPrimitive.Trigger
                key={`tab-trigger-${group.id}`}
                value={group.name}
                className={twMerge(
                  'group',
                  'first:rounded-bl-lg last:rounded-br-lg',
                  'border-t first:border-r last:border-l',
                  'border-gray-300',
                  'rdx-state-active:border-b-gray-700 focus-visible:rdx-state-active:border-b-transparent rdx-state-inactive:bg-gray-50 ',
                  'flex-1 px-3 py-2.5',
                  'focus:rdx-state-active:border-t-red',
                  'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75'
                )}
              >
                <span
                  className={twMerge('text-sm font-medium', 'text-gray-700')}
                >
                  Gruppe {group.name}
                </span>
              </TabsPrimitive.Trigger>
            ))}

            <TabsPrimitive.Trigger
              key={`tab-trigger-create`}
              value="create"
              className={twMerge(
                'group',
                'first:rounded-bl-lg last:rounded-br-lg',
                'border-t first:border-r last:border-l',
                'border-gray-300',
                'rdx-state-active:border-b-gray-700 focus-visible:rdx-state-active:border-b-transparent rdx-state-inactive:bg-gray-50 ',
                'flex-1 px-3 py-2.5',
                'focus:rdx-state-active:border-t-red',
                'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75'
              )}
            >
              <span className={twMerge('text-sm font-medium', 'text-gray-700')}>
                Gruppe erstellen/beitreten
              </span>
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>
        </TabsPrimitive.Root>
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
