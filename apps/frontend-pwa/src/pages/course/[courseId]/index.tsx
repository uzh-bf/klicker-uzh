import { useMutation, useQuery } from '@apollo/client'
import GroupLeaderboard from '@components/GroupLeaderboard'
import Layout from '@components/Layout'
import Leaderboard from '@components/Leaderboard'
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
import { Button, H3 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { GetServerSideProps } from 'next'
import { ParticipantOther } from '../../../components/Participant'
import { Podium } from '../../../components/Podium'
import Tabs from '../../../components/Tabs'

import Image from 'next/future/image'
import { useState } from 'react'

const POSITIONS = [
  [17, 20],
  [17, 70],
  [17, 10],
  [17, 80],
  [5, 25],
  [5, 65],
  [5, 15],
  [5, 75],
  [5, 5],
  [5, 85],
]

function GroupVisualization({ participants }) {
  return (
    <div className="relative w-full md:w-[500px] h-48 m-auto border border-b-4 rounded md:h-64 border-slate-300 border-b-slate-700">
      <div className="absolute top-0 bottom-0 left-0 right-0 desert-bg grayscale-[70%]"></div>

      <div className="absolute bottom-0 left-0 right-0 top-8">
        <Image className="" src="/rocket_base.svg" fill />
      </div>

      {participants.slice(0, 10).map((participant, ix) => (
        <Image
          key={participant.avatar}
          className="absolute bg-white border border-white rounded-full shadow"
          style={{
            bottom: `${POSITIONS[ix][0]}%`,
            left: `${POSITIONS[ix][1]}%`,
          }}
          src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
            participant.avatar ?? 'placeholder'
          }.svg`}
          alt=""
          height={32}
          width={32}
        />
      ))}
    </div>
  )
}

function CourseOverview({ courseId }: any) {
  const [selectedTab, setSelectedTab] = useState('global')

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

  const [createParticipantGroup] = useMutation(CreateParticipantGroupDocument)
  const [joinParticipantGroup] = useMutation(JoinParticipantGroupDocument)
  const [leaveParticipantGroup] = useMutation(LeaveParticipantGroupDocument)

  if (!data?.getCourseOverviewData || loading) return <div>Loading...</div>
  if (error) return <p>Oh no... {error.message}</p>

  const {
    course,
    participant,
    participation,
    leaderboard,
    leaderboardStatistics,
    groupLeaderboard,
    groupLeaderboardStatistics,
  } = data.getCourseOverviewData

  return (
    <Layout
      displayName="Leaderboard"
      courseName={course.displayName}
      courseColor={course.color}
    >
      <div className="md:m-auto md:max-w-5xl md:w-full md:border md:rounded">
        <Tabs
          defaultValue="global"
          value={selectedTab}
          onValueChange={(tab) => setSelectedTab(tab)}
        >
          <Tabs.TabList>
            <Tabs.Tab key="course" value="global" label="Leaderboard" />

            {data.participantGroups?.map((group) => (
              <Tabs.Tab
                key={group.id}
                value={group.id}
                label={`Gruppe ${group.name}`}
              />
            ))}

            <Tabs.Tab
              key="create"
              value="create"
              label="Gruppe erstellen/beitreten"
            />
          </Tabs.TabList>

          <Tabs.TabContent key="course" value="global">
            <div className="flex flex-col gap-10 md:flex-row">
              <div className="flex flex-col justify-between flex-1 gap-6">
                <div>
                  <H3 className="mb-4">Individuelles Leaderboard</H3>

                  <Podium leaderboard={leaderboard} />
                  <Leaderboard
                    leaderboard={leaderboard}
                    courseId={courseId}
                    participant={participant}
                    participation={participation}
                    onJoin={joinCourse}
                    onLeave={leaveCourse}
                  />
                  <div className="mt-4 mb-2 text-sm text-right text-slate-600">
                    <div>
                      Anzahl Teilnehmende:{' '}
                      {leaderboardStatistics.participantCount}
                    </div>
                    <div>
                      Durchschnittl. Punkte:{' '}
                      {leaderboardStatistics.averageScore?.toFixed(2)}
                    </div>
                  </div>
                  {/* TODO: HISTOGRAMM */}
                </div>

                <div className="p-2 text-sm text-center rounded text-slate-500 bg-slate-100">
                  Das individuelle Leaderboard wird stündlich aktualisiert.
                </div>
              </div>

              <div className="flex flex-col justify-between flex-1 gap-8">
                <div>
                  <H3 className="mb-4">Gruppenleaderboard</H3>

                  <Podium
                    leaderboard={groupLeaderboard?.map((entry) => ({
                      username: entry.name,
                      score: entry.score,
                    }))}
                  />
                  {!groupLeaderboard ||
                    (groupLeaderboard.length === 0 && (
                      <div className="mt-6">
                        Bisher wurden noch keine Gruppen gebildet. Los
                        geht&apos;s!
                      </div>
                    ))}
                  <div className="pt-8 space-y-2">
                    {groupLeaderboard?.map((entry) => (
                      <ParticipantOther
                        key={entry.id}
                        pseudonym={entry.name}
                        points={entry.score}
                        withAvatar={false}
                      />
                    ))}
                  </div>
                  <div className="mt-4 mb-2 text-sm text-right text-slate-600">
                    <div>
                      Anzahl Gruppen:{' '}
                      {groupLeaderboardStatistics.participantCount}
                    </div>
                    <div>
                      Durchschnittl. Punkte:{' '}
                      {groupLeaderboardStatistics.averageScore?.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="p-2 text-sm text-center rounded text-slate-500 bg-slate-100">
                  Das Gruppenleaderboard wird täglich aktualisiert.
                </div>
              </div>
            </div>
          </Tabs.TabContent>

          {data.participantGroups?.map((group) => (
            <Tabs.TabContent key={group.id} value={group.id}>
              <div className="flex flex-col">
                <H3 className="flex flex-row justify-between">
                  <div>Gruppe {group.name}</div>
                  <div>{group.code}</div>
                </H3>

                <GroupVisualization participants={group.participants} />
                <GroupLeaderboard
                  courseId={courseId}
                  groupId={group.id}
                  leaderboard={group.participants}
                  onLeave={() => {
                    leaveParticipantGroup({
                      variables: {
                        courseId,
                        groupId: group.id,
                      },
                      refetchQueries: [GetCourseOverviewDataDocument],
                    })

                    setSelectedTab('global')
                  }}
                />

                <div className="self-end mt-6 text-sm w-60 text-slate-600">
                  <div className="flex flex-row justify-between">
                    <div>Punkte durch Mitglieder</div>
                    <div>{group.averageMemberScore}</div>
                  </div>
                  <div className="flex flex-row justify-between">
                    <div>Punkte aus Gruppenaktivitäten</div>
                    <div>{group.groupActivityScore}</div>
                  </div>
                  <div className="flex flex-row justify-between font-bold">
                    <div>Total Punkte</div>
                    <div>{group.score}</div>
                  </div>
                </div>
              </div>
            </Tabs.TabContent>
          ))}

          <Tabs.TabContent key="create" value="create">
            <H3>Gruppe erstellen</H3>
            <Formik
              initialValues={{ groupName: '' }}
              onSubmit={async (values) => {
                const result = await createParticipantGroup({
                  variables: {
                    courseId: courseId,
                    name: values.groupName,
                  },
                  refetchQueries: [
                    {
                      query: GetParticipantGroupsDocument,
                      variables: { courseId: courseId },
                    },
                    {
                      query: GetCourseOverviewDataDocument,
                      variables: { courseId: courseId },
                    },
                  ],
                })

                if (result.data?.createParticipantGroup?.id) {
                  setSelectedTab(result.data.createParticipantGroup.id)
                }
              }}
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
                const result = await joinParticipantGroup({
                  variables: {
                    courseId: courseId,
                    code: Number(values.code) >> 0,
                  },
                  refetchQueries: [
                    {
                      query: GetCourseOverviewDataDocument,
                      variables: { courseId },
                    },
                  ],
                })

                if (result.data?.joinParticipantGroup?.id) {
                  setSelectedTab(result.data.joinParticipantGroup.id)
                }
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
          </Tabs.TabContent>
        </Tabs>
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
