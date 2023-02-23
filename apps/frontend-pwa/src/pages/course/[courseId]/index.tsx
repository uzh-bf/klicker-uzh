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
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import Leaderboard from 'shared-components/src/Leaderboard'
import { twMerge } from 'tailwind-merge'
import Tabs from '../../../components/common/Tabs'
import Layout from '../../../components/Layout'
import GroupVisualization from '../../../components/participant/GroupVisualization'

// TODO: replace fields in this component through our own design system components

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
  const t = useTranslations()
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
    <Layout
      displayName={t('shared.generic.leaderboard')}
      course={course ?? undefined}
    >
      <div className="md:mx-auto md:max-w-6xl md:w-full md:border md:rounded">
        <Tabs
          defaultValue="global"
          value={selectedTab}
          onValueChange={(tab) => setSelectedTab(tab)}
        >
          <Tabs.TabList>
            <Tabs.Tab
              key="leaderboard"
              value="global"
              label={t('shared.generic.leaderboard')}
            />

            {course?.description && (
              <Tabs.Tab
                key="info"
                value="info"
                label={t('pwa.courses.courseInformation')}
              />
            )}

            {data.participantGroups?.map((group) => (
              <Tabs.Tab
                key={group.id}
                value={group.id}
                label={`${t('shared.generic.group')} ${group.name}`}
              />
            ))}

            {(data.participantGroups?.length ?? 0) < 1 && (
              <Tabs.Tab
                key="create"
                value="create"
                label={t('pwa.courses.createJoinGroup')}
              />
            )}
          </Tabs.TabList>

          {course?.description && (
            <Tabs.TabContent key="info" value="info" className="md:px-4">
              <H3 className={{ root: 'mb-4' }}>
                {t('pwa.courses.courseInformation')}
              </H3>
              <DynamicMarkdown content={course.description} />
            </Tabs.TabContent>
          )}

          <Tabs.TabContent key="course" value="global" className="md:px-4">
            <div className="flex flex-col gap-6 overflow-x-auto md:flex-row">
              <div className="flex flex-col justify-between flex-1 gap-6">
                <div>
                  <H3 className={{ root: 'mb-4' }}>
                    {t('pwa.courses.individualLeaderboard')}
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
                      {t('shared.leaderboard.participantCount', {
                        number: leaderboardStatistics?.participantCount,
                      })}
                    </div>
                    <div>
                      {t('shared.leaderboard.averagePoints', {
                        number: leaderboardStatistics?.averageScore?.toFixed(2),
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-2 text-sm text-center rounded text-slate-500 bg-slate-100">
                  {t('pwa.courses.individualLeaderboardUpdate')}
                </div>
              </div>

              <div className="flex flex-col justify-between flex-1 gap-8">
                <div>
                  <H3 className={{ root: 'mb-4' }}>
                    {t('pwa.courses.groupLeaderboard')}
                  </H3>

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
                      <div className="mt-6">{t('pwa.courses.noGroups')}</div>
                    ))}
                  {groupLeaderboard &&
                    groupLeaderboard.length !== 0 &&
                    filteredGroupLeaderboard?.length === 0 && (
                      <div>{t('pwa.courses.noGroupPoints')}</div>
                    )}

                  <div className="mt-4 mb-2 text-sm text-right text-slate-600">
                    <div>
                      {t('shared.leaderboard.participantCount', {
                        number: groupLeaderboardStatistics?.participantCount,
                      })}
                    </div>
                    <div>
                      {t('shared.leaderboard.averagePoints', {
                        number:
                          groupLeaderboardStatistics?.averageScore?.toFixed(2),
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-2 text-sm text-center rounded text-slate-500 bg-slate-100">
                  {/* {t('pwa.courses.groupLeaderboardUpdate')} */}
                  {t.rich('pwa.courses.groupLeaderboardUpdate', {
                    b: () => <br />,
                  })}
                </div>
              </div>
            </div>

            {/* // TODO: update the translation strings as well, once this hard-coded content has been updated with a flexible implementation */}
            {course?.awards && course?.awards?.length != 0 && (
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
                  <div>
                    {t('shared.generic.group')} {group.name}
                  </div>
                  <div>{group.code}</div>
                </H3>

                <div className="flex flex-row flex-wrap gap-4">
                  <div className="flex flex-col flex-1">
                    <Leaderboard
                      leaderboard={group.participants}
                      participant={participant}
                      onProfileClick={openProfileModal}
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
                        <div>{t('pwa.courses.membersScore')}</div>
                        <div>{group.averageMemberScore}</div>
                      </div>
                      <div className="flex flex-row justify-between">
                        <div>{t('pwa.courses.groupActivityScore')}</div>
                        <div>{group.groupActivityScore}</div>
                      </div>
                      <div className="flex flex-row justify-between font-bold">
                        <div>{t('pwa.courses.totalScore')}</div>
                        <div>{group.score}</div>
                      </div>
                    </div>
                  </div>
                  <GroupVisualization participants={group.participants} />
                </div>

                {/* // TODO: add internationlized strings, once the hard-coded implementation has been updated */}
                {data.getCourseOverviewData?.course?.id ===
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
            <H3>{t('pwa.courses.createGroup')}</H3>
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
                    placeholder={t('pwa.courses.groupName')}
                  />
                  <ErrorMessage
                    name="groupName"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <Button type="submit">{t('shared.generic.create')}</Button>
                </div>
              </Form>
            </Formik>

            <H3 className={{ root: 'mt-4' }}>{t('pwa.courses.joinGroup')}</H3>
            <Formik
              initialValues={{ code: '' }}
              onSubmit={async (values) => {
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
                  <Field
                    type="text"
                    name="code"
                    placeholder={t('pwa.courses.code')}
                  />
                  <ErrorMessage
                    name="code"
                    component="div"
                    className="text-sm text-red-400"
                  />
                  <Button type="submit">{t('shared.generic.join')}</Button>
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
      messages: {
        ...require(`shared-components/src/intl-messages/${ctx.locale}.json`),
      },
    },
  })
}

export default CourseOverview
