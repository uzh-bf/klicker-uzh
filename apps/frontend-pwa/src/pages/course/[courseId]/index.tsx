import { useMutation, useQuery } from '@apollo/client'
import GroupView from '@components/course/GroupView'
import {
  GetCourseOverviewDataDocument,
  GroupActivityInstance,
  JoinCourseDocument,
  LeaveCourseDocument,
  LeaveParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Podium } from '@klicker-uzh/shared-components/src/Podium'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { Button, H3, Tabs, UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import Rank1Img from 'public/rank1.svg'
import Rank2Img from 'public/rank2.svg'
import Rank3Img from 'public/rank3.svg'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../components/Layout'
import GroupActivityListSubscriber from '../../../components/groupActivity/GroupActivityListSubscriber'
import LeaveLeaderboardModal from '../../../components/participant/LeaveLeaderboardModal'
import ParticipantProfileModal from '../../../components/participant/ParticipantProfileModal'
import GroupCreationActions from '../../../components/participant/groups/GroupCreationActions'

interface Props {
  courseId: string
  participantToken?: string
  cookiesAvailable?: boolean
}

function CourseOverview({
  courseId,
  participantToken,
  cookiesAvailable,
}: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState('global')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false)
  const [participantId, setParticipantId] = useState<string | undefined>()
  const [isLeaveCourseModalOpen, setIsLeaveCourseModalOpen] = useState(false)

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, loading, error, subscribeToMore } = useQuery(
    GetCourseOverviewDataDocument,
    {
      variables: { courseId },
    }
  )

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

  const [leaveParticipantGroup] = useMutation(LeaveParticipantGroupDocument)

  useEffect(() => {
    if (
      data &&
      !data.getCourseOverviewData?.course?.isGamificationEnabled &&
      data.getCourseOverviewData?.course?.description
    ) {
      setSelectedTab('info')
    }
  }, [data])

  if (
    !data?.getCourseOverviewData ||
    !data.getCourseOverviewData.course ||
    loading
  )
    return (
      <Layout displayName={t('shared.generic.leaderboard')}>
        <Loader />
      </Layout>
    )

  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const {
    course,
    participant,
    participation,
    leaderboard,
    leaderboardStatistics,
    groupLeaderboard,
    groupLeaderboardStatistics,
    groupActivityInstances,
    inRandomGroupPool,
  } = data.getCourseOverviewData

  const filteredGroupLeaderboard = groupLeaderboard?.filter(
    (group) => group.score > 0
  )

  const top10Participants = leaderboard
    ? leaderboard.map((entry) => entry.participantId)
    : []

  const indexedGroupActivityInstances =
    groupActivityInstances?.reduce<Record<string, GroupActivityInstance>>(
      (acc, groupActivityInstance) => {
        return {
          ...acc,
          [groupActivityInstance.groupActivityId]: groupActivityInstance,
        }
      },
      {}
    ) ?? {}

  const openProfileModal = (id: string, isSelf: boolean) => {
    if (isSelf) {
      router.push('/profile')
      return
    }
    setParticipantId(id)
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
      {course.isGamificationEnabled || course.description ? (
        <>
          <GroupActivityListSubscriber
            courseId={courseId}
            subscribeToMore={subscribeToMore}
          />
          <div className="md:mx-auto md:w-full md:max-w-6xl md:rounded md:border">
            <Tabs
              defaultValue={course.isGamificationEnabled ? 'global' : 'info'}
              value={selectedTab}
              onValueChange={(tab) => setSelectedTab(tab)}
            >
              <Tabs.TabList>
                {course.isGamificationEnabled && (
                  <Tabs.Tab
                    key="leaderboard"
                    value="global"
                    label={t('shared.generic.leaderboard')}
                    data={{ cy: 'student-course-leaderboard-tab' }}
                  />
                )}

                {course.description && (
                  <Tabs.Tab
                    key="info"
                    value="info"
                    label={t('pwa.courses.courseInformation')}
                    data={{ cy: 'student-course-information' }}
                  />
                )}

                {course.isGamificationEnabled &&
                  data.participantGroups?.map((group, ix) => (
                    <Tabs.Tab
                      key={group.id}
                      value={group.id}
                      label={`${t('shared.generic.group')} ${group.name}`}
                      data={{ cy: `student-course-existing-group-${ix}` }}
                    />
                  ))}

                {course.isGamificationEnabled &&
                  course.isGroupCreationEnabled &&
                  !course.isGroupDeadlinePassed &&
                  (data.participantGroups?.length ?? 0) < 1 && (
                    <Tabs.Tab
                      key="create"
                      value="create"
                      label={t('pwa.courses.createJoinGroup')}
                      data={{ cy: 'student-course-create-group' }}
                    />
                  )}
              </Tabs.TabList>

              {course.description && (
                <Tabs.TabContent key="info" value="info" className="md:px-4">
                  <H3 className={{ root: 'mb-4' }}>
                    {t('pwa.courses.courseInformation')}
                  </H3>
                  <DynamicMarkdown
                    withProse
                    className={{ root: 'prose-headings:mt-0 prose-p:mt-0' }}
                    content={course.description}
                  />
                </Tabs.TabContent>
              )}

              {course.isGamificationEnabled && (
                <Tabs.TabContent
                  key="course"
                  value="global"
                  className="md:px-4"
                >
                  <div className="flex flex-col gap-6 overflow-x-auto md:flex-row">
                    <div className="flex flex-1 flex-col justify-between gap-6">
                      <div>
                        <H3 className={{ root: 'mb-4' }}>
                          {t('pwa.courses.individualLeaderboard')}
                        </H3>

                        {participant?.id && participation?.isActive && (
                          <Leaderboard
                            leaderboard={leaderboard ?? []}
                            onJoin={joinCourse}
                            onLeave={() => setIsLeaveCourseModalOpen(true)}
                            participant={participant ?? undefined}
                            onParticipantClick={openProfileModal}
                            podiumImgSrc={{
                              rank1: Rank1Img,
                              rank2: Rank2Img,
                              rank3: Rank3Img,
                            }}
                            topKOnly={10}
                          />
                        )}
                        {participant?.id && !participation?.isActive && (
                          <div className="space-y-4">
                            <Podium leaderboard={[]} />
                            <div className="max-w-none rounded border border-slate-300 bg-slate-100 p-2 text-sm text-slate-600">
                              <Markdown
                                withProse
                                withLinkButtons={false}
                                content={t(
                                  'pwa.general.joinLeaderboardNotice',
                                  {
                                    username: participant.username,
                                    courseName: course.displayName,
                                  }
                                )}
                              />
                              <Button
                                fluid
                                className={{ root: 'bg-white' }}
                                onClick={() => joinCourse()}
                                data={{ cy: 'student-course-join-leaderboard' }}
                              >
                                {t.rich('pwa.courses.joinLeaderboardCourse', {
                                  name: course.displayName,
                                  b: (text) => (
                                    <span className="font-bold">{text}</span>
                                  ),
                                })}
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="mb-2 mt-4 text-right text-sm text-slate-600">
                          <div>
                            {t('shared.leaderboard.participantCount', {
                              number: leaderboardStatistics?.participantCount,
                            })}
                          </div>
                          <div>
                            {t('shared.leaderboard.averagePoints', {
                              number:
                                leaderboardStatistics?.averageScore?.toFixed(2),
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="rounded bg-slate-100 p-2 text-center text-sm text-slate-500">
                        {t('pwa.courses.individualLeaderboardUpdate')}
                      </div>
                    </div>

                    {course.isGroupCreationEnabled && (
                      <div className="flex flex-1 flex-col justify-between gap-8">
                        <div>
                          <H3 className={{ root: 'mb-4' }}>
                            {t('pwa.courses.groupLeaderboard')}
                          </H3>

                          <Leaderboard
                            leaderboard={
                              filteredGroupLeaderboard?.map((entry) => ({
                                id: entry.id,
                                username: entry.name,
                                score: entry.score,
                                rank: entry.rank,
                                isMember: entry.isMember ?? false,
                              })) || []
                            }
                            hideAvatars={true}
                          />

                          {!groupLeaderboard ||
                            (groupLeaderboard.length === 0 && (
                              <div className="mt-6">
                                {t('pwa.courses.noGroups')}
                              </div>
                            ))}
                          {groupLeaderboard &&
                            groupLeaderboard.length !== 0 &&
                            filteredGroupLeaderboard?.length === 0 && (
                              <div>{t('pwa.courses.noGroupPoints')}</div>
                            )}

                          <div className="mb-2 mt-4 text-right text-sm text-slate-600">
                            <div>
                              {t('shared.leaderboard.participantCount', {
                                number:
                                  groupLeaderboardStatistics?.participantCount,
                              })}
                            </div>
                            <div>
                              {t('shared.leaderboard.averagePoints', {
                                number:
                                  groupLeaderboardStatistics?.averageScore?.toFixed(
                                    2
                                  ),
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="rounded bg-slate-100 p-2 text-center text-sm text-slate-500">
                          {t.rich('pwa.courses.groupLeaderboardUpdate', {
                            b: () => <br />,
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* // TODO: update the translation strings as well, once this hard-coded content has been updated with a flexible implementation */}
                  {course.awards && course.awards?.length != 0 && (
                    <div className="mt-4 rounded border border-orange-200 bg-orange-100 px-4 py-3 shadow md:mt-6">
                      <H3 className={{ root: 'mb-2 text-base' }}>
                        {t('pwa.courses.awards')}
                      </H3>
                      <div className="flex flex-col gap-1 text-sm text-gray-700 md:flex-row md:flex-wrap md:gap-6">
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
                                      : t('pwa.courses.open')}
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
                                      : t('pwa.courses.open')}
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
              )}

              {participant &&
                participation &&
                course.isGamificationEnabled &&
                data.participantGroups?.map((group) => (
                  <GroupView
                    key={group.id}
                    group={group}
                    participation={participation}
                    participant={participant}
                    groupActivities={course.groupActivities ?? []}
                    groupActivityInstances={indexedGroupActivityInstances}
                    courseId={course.id}
                    maxGroupSize={course.maxGroupSize}
                    groupDeadlineDate={course.groupDeadlineDate}
                    isGroupDeadlinePassed={
                      course.isGroupDeadlinePassed ?? false
                    }
                    setSelectedTab={setSelectedTab}
                    subscribeToMore={subscribeToMore}
                  />
                ))}

              {course.isGamificationEnabled && (
                <Tabs.TabContent key="create" value="create">
                  <GroupCreationActions
                    courseId={courseId}
                    setSelectedTab={setSelectedTab}
                    inRandomGroupPool={inRandomGroupPool ?? false}
                  />
                </Tabs.TabContent>
              )}
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
          <LeaveLeaderboardModal
            isModalOpen={isLeaveCourseModalOpen}
            setIsModalOpen={setIsLeaveCourseModalOpen}
            onConfirm={() => {
              leaveCourse()
              setIsLeaveCourseModalOpen(false)
            }}
          />
        </>
      ) : (
        <UserNotification
          type="info"
          message={t('pwa.courses.noGamificationOrDescription', {
            courseName: course.displayName,
          })}
        />
      )}
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, cookiesAvailable } = await getParticipantToken({
    apolloClient,
    courseId: ctx.params.courseId,
    ctx,
  })

  if (participantToken) {
    return {
      props: {
        participantToken,
        cookiesAvailable,
        courseId: ctx.params.courseId,
        messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
          .default,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      courseId: ctx.params.courseId,
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default CourseOverview
