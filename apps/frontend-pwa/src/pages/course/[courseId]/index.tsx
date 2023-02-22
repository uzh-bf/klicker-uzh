import { useMutation, useQuery } from '@apollo/client'
import ParticipantProfileModal from '@components/participant/ParticipantProfileModal'
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
import { Button, H3, H4 } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import Leaderboard from 'shared-components/src/Leaderboard'
import { twMerge } from 'tailwind-merge'
import Tabs from '../../../components/common/Tabs'
import Layout from '../../../components/Layout'
import GroupVisualization from '../../../components/participant/GroupVisualization'

const DynamicMarkdown = dynamic(
  async () => {
    const { Markdown } = await import('@klicker-uzh/markdown')
    return Markdown
  },
  {
    ssr: false,
  }
)

function CourseOverview({ courseId }: any) {
  const [selectedTab, setSelectedTab] = useState('global')
  // const [participantModalOpen, setParticipantModalOpen] =
  //   useState<boolean>(false)
  // const [selectedParticipant, setSelectedParticipant] = useState<
  //   LeaderboardEntry | undefined
  // >(undefined)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false)
  const [participantId, setParticipantId] = useState<string | undefined>()

  console.log('isProfileModalOpen: ', isProfileModalOpen)

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

  console.log('course: ', course)
  console.log('participant: ', participant)
  console.log('leaderboard: ', leaderboard)

  const filteredGroupLeaderboard = groupLeaderboard?.filter(
    (group) => group.score > 0
  )

  const top10Participants = leaderboard
    ? leaderboard.map((entry) => entry.participantId)
    : []

  const openProfileModal = (modalData: any) => {
    setParticipantId(modalData.participantId)
    setIsProfileModalOpen((prev) => !prev)
  }

  const closeProfileModal = () => {
    setParticipantId(undefined)
    setIsProfileModalOpen((prev) => !prev)
  }

  return (
    <Layout displayName="Leaderboard" course={course ?? undefined}>
      <div className="md:mx-auto md:max-w-6xl md:w-full md:border md:rounded">
        <Tabs
          defaultValue="global"
          value={selectedTab}
          onValueChange={(tab) => setSelectedTab(tab)}
        >
          <Tabs.TabList>
            <Tabs.Tab key="course" value="global" label="Leaderboard" />

            {course?.description && (
              <Tabs.Tab key="info" value="info" label="Kursinformationen" />
            )}

            {data.participantGroups?.map((group) => (
              <Tabs.Tab
                key={group.id}
                value={group.id}
                label={`Gruppe ${group.name}`}
              />
            ))}

            {(data.participantGroups?.length ?? 0) < 1 && (
              <Tabs.Tab
                key="create"
                value="create"
                label="Gruppe erstellen/beitreten"
              />
            )}
          </Tabs.TabList>

          {course?.description && (
            <Tabs.TabContent key="info" value="info" className="md:px-4">
              <H3 className={{ root: 'mb-4' }}>Kursinformationen</H3>
              <DynamicMarkdown content={course.description} />
            </Tabs.TabContent>
          )}

          <Tabs.TabContent key="course" value="global" className="md:px-4">
            <div className="flex flex-col gap-6 overflow-x-auto md:flex-row">
              <div className="flex flex-col justify-between flex-1 gap-6">
                <div>
                  <H3 className={{ root: 'mb-4' }}>
                    Individuelles Leaderboard
                  </H3>

                  <Leaderboard
                    leaderboard={leaderboard || []}
                    activeParticipation={participation?.isActive}
                    onJoin={joinCourse}
                    onLeave={leaveCourse}
                    participant={participant}
                    onProfileClick={openProfileModal}
                    // onParitcipantClick={(participantId, isSelf) => {
                    //   if (!isSelf) {
                    //     setSelectedParticipant(
                    //       leaderboard?.find(
                    //         (entry) => entry.participantId === participantId
                    //       )
                    //     )
                    //     setParticipantModalOpen(true)
                    //   } else {
                    //     router.push('/profile')
                    //   }
                    // }}
                  />

                  {/* <Modal
                    open={participantModalOpen}
                    onClose={() => setParticipantModalOpen(false)}
                  >
                    {selectedParticipant ? (
                      <div className="flex flex-col items-center">
                        <div className={twMerge("relative border-b-4 w-36 h-36 md:w-48 md:h-48", theme.primaryBorderDark)}>
                          <Image
                            className="bg-white"
                            src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
                              selectedParticipant.avatar ?? 'placeholder'
                            }.svg`}
                            alt=""
                            fill
                          />
                        </div>
                        <div className="mt-4 text-xl font-bold">
                          {selectedParticipant.username}
                        </div>
                        <div className="mt-3">
                          Aktueller Rang: {selectedParticipant.rank}
                        </div>
                        <div>
                          Aktuelle Punktzahl: {selectedParticipant.score}
                        </div>
                        <div>Errungenschaften: TODO</div>
                      </div>
                    ) : (
                      <div>Dieser Teilnehmer hat kein öffentliches Profil</div>
                    )}
                  </Modal> */}

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
                  <H3 className={{ root: 'mb-4' }}>Gruppenleaderboard</H3>

                  <Leaderboard
                    leaderboard={
                      filteredGroupLeaderboard?.map((entry) => ({
                        username: entry.name,
                        score: entry.score,
                      })) || []
                    }
                    hideAvatars={true}
                  />

                  {!groupLeaderboard ||
                    (groupLeaderboard.length === 0 && (
                      <div className="mt-6">
                        Bisher wurden noch keine Gruppen gebildet. Los
                        geht&apos;s!
                      </div>
                    ))}
                  {groupLeaderboard &&
                    groupLeaderboard.length !== 0 &&
                    filteredGroupLeaderboard?.length === 0 && (
                      <div>
                        Bisher hat noch keine Gruppe Punkte erhalten. Los
                        geht&apos;s!
                      </div>
                    )}

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
                  Das Gruppenleaderboard wird täglich aktualisiert. <br />
                  Gruppen mit einem Mitglied erhalten keine Punkte.
                </div>
              </div>
            </div>

            {course?.awards?.length != 0 && (
              <div className="px-4 py-3 mt-4 bg-orange-100 border border-orange-200 rounded shadow md:mt-6">
                <H3 className={{ root: 'mb-2 text-base' }}>
                  BF-Champion Awards
                </H3>
                <div className="flex flex-col gap-1 text-sm text-gray-700 md:gap-6 md:flex-row md:flex-wrap">
                  <div className="flex-1 space-y-1">
                    {course.awards
                      ?.filter((award) => award.type === 'PARTICIPANT')
                      .map((award) => (
                        <div
                          key={award.id}
                          className={twMerge(
                            'flex flex-row justify-between',
                            award.participant && 'text-orange-700'
                          )}
                        >
                          <div className="flex flex-row gap-3">
                            <div>{award.displayName}:</div>
                            <div>
                              {award.participant
                                ? `🥳  ${award.participant.username}  🥳`
                                : 'offen'}
                            </div>
                          </div>
                          <div>{award.description}</div>
                        </div>
                      ))}
                  </div>
                  <div className="flex-1 space-y-1">
                    {course.awards
                      ?.filter((award) => award.type === 'GROUP')
                      .map((award) => (
                        <div
                          key={award.id}
                          className={twMerge(
                            'flex flex-row justify-between',
                            award.participantGroup && 'text-orange-700'
                          )}
                        >
                          <div className="flex flex-row gap-3">
                            <div>{award.displayName}:</div>
                            <div>
                              {award.participantGroup
                                ? `🥳  ${award.participantGroup.name}  🥳`
                                : 'offen'}
                            </div>
                          </div>
                          <div>{award.description}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </Tabs.TabContent>

          {data.participantGroups?.map((group) => (
            <Tabs.TabContent key={group.id} value={group.id}>
              <div className="flex flex-col gap-4">
                <H3 className={{ root: 'flex flex-row justify-between' }}>
                  <div>Gruppe {group.name}</div>
                  <div>{group.code}</div>
                </H3>

                <div className="flex flex-row flex-wrap gap-4">
                  <div className="flex flex-col flex-1">
                    <Leaderboard
                      leaderboard={group.participants}
                      participant={participant}
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
                      hidePodium
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
                  <GroupVisualization participants={group.participants} />
                </div>

                {data.getCourseOverviewData?.course.id ===
                  '2b302436-4fc3-4d5d-bbfb-1e13b4ee11b2' && (
                  <div className="mt-8">
                    <H4>Gruppenaktivitäten</H4>
                    {/* <Link
                      href={`/group/${group.id}/activity/dd522580-393a-4839-a193-2871feb2d98f`}
                      className="inline-flex items-center gap-2 hover:text-orange-700"
                    > */}
                    <div>
                      {/* <FontAwesomeIcon icon={faExternalLink} /> */}
                      <span className="text-gray-600">
                        Gruppenquest - 07.11.22 17:00 bis 13.11.22 23:00
                      </span>
                    </div>
                    {/* </Link> */}
                  </div>
                )}
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

            <H3 className={{ root: 'mt-4' }}>Gruppe beitreten</H3>
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
        {isProfileModalOpen && participantId && (
          <ParticipantProfileModal
            isProfileModalOpen={isProfileModalOpen}
            closeProfileModal={closeProfileModal}
            participantId={participantId}
            top10Participants={top10Participants}
          />
        )}
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
