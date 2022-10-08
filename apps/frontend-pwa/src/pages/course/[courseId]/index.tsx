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
  [30, 130],
  [40, 330],
  [40, 70],
  [45, 380],
  [10, 95],
  [10, 355],
  [20, 40],
  [15, 410],
  [35, 5],
  [40, 440],
]

function GroupVisualization({ participants }) {
  return (
    <div className="relative h-64 m-auto border border-b-4 rounded border-slate-300 border-b-slate-700 w-[500px]">
      <div className="absolute top-0 bottom-0 left-0 right-0 desert-bg grayscale-[70%]"></div>

      <div className="absolute bottom-0 left-0 right-0 top-8">
        <Image className="" src="/rocket_base.svg" fill />
      </div>

      {participants.map((participant, ix) => (
        <Image
          key={participant.avatar}
          className="absolute bg-white border-4 border-white rounded-full shadow"
          style={{
            bottom: POSITIONS[ix][0],
            left: POSITIONS[ix][1],
          }}
          src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
            participant.avatar ?? 'placeholder'
          }.svg`}
          alt=""
          height={40}
          width={40}
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
            <div className="flex flex-col gap-8 md:flex-row">
              <div className="flex-1">
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
                HISTOGRAMM
              </div>

              <div className="flex-1">
                <H3 className="mb-4">Gruppenleaderboard</H3>
                {!data.getCourseOverviewData.groupLeaderboard ||
                  (data.getCourseOverviewData.groupLeaderboard.length === 0 && (
                    <div>
                      Bisher wurden noch keine Gruppen gebildet. Los
                      geht&apos;s!
                    </div>
                  ))}
                {data.getCourseOverviewData.groupLeaderboard?.map((entry) => (
                  <ParticipantOther
                    key={entry.id}
                    pseudonym={entry.name}
                    points={entry.score}
                    withAvatar={false}
                  />
                ))}
              </div>
            </div>
          </Tabs.TabContent>

          {data.participantGroups?.map((group) => (
            <Tabs.TabContent key={group.id} value={group.id}>
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
              onSubmit={(values, actions) => {
                joinParticipantGroup({
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
