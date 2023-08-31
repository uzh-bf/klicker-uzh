import { useMutation, useQuery } from '@apollo/client'
import { faExternalLink } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateParticipantGroupDocument,
  GetCourseOverviewDataDocument,
  GetParticipantGroupsDocument,
  GroupActivityInstance,
  JoinCourseDocument,
  JoinParticipantGroupDocument,
  LeaveCourseDocument,
  LeaveParticipantGroupDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import {
  Button,
  FormikNumberField,
  FormikTextField,
  H3,
  H4,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import DynamicMarkdown from 'src/components/learningElements/DynamicMarkdown'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../components/Layout'
import Tabs from '../../../components/common/Tabs'
import GroupVisualization from '../../../components/participant/GroupVisualization'
import ParticipantProfileModal from '../../../components/participant/ParticipantProfileModal'

import Loader from '@klicker-uzh/shared-components/src/Loader'
import dayjs from 'dayjs'
import Rank1Img from 'public/rank1.svg'
import Rank2Img from 'public/rank2.svg'
import Rank3Img from 'public/rank3.svg'

// TODO: replace fields in this component through our own design system components

interface Props {
  courseId: string
}

function CourseOverview({ courseId }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState('global')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false)
  const [participantId, setParticipantId] = useState<string | undefined>()

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

  if (!data?.getCourseOverviewData || loading)
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
      <div className="md:mx-auto md:max-w-6xl md:w-full md:border md:rounded">
        <Tabs
          defaultValue="global"
          value={selectedTab}
          onValueChange={(tab) => setSelectedTab(tab)}
        >
          <Tabs.TabList>
            {course?.isGamificationEnabled && (
              <Tabs.Tab
                key="leaderboard"
                value="global"
                label={t('shared.generic.leaderboard')}
              />
            )}

            {course?.description && (
              <Tabs.Tab
                key="info"
                value="info"
                label={t('pwa.courses.courseInformation')}
              />
            )}

            {course?.isGamificationEnabled &&
              data.participantGroups?.map((group) => (
                <Tabs.Tab
                  key={group.id}
                  value={group.id}
                  label={`${t('shared.generic.group')} ${group.name}`}
                />
              ))}

            {course?.isGamificationEnabled &&
              !course?.isGroupDeadlinePassed &&
              (data.participantGroups?.length ?? 0) < 1 && (
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

          {course?.isGamificationEnabled && (
            <Tabs.TabContent key="course" value="global" className="md:px-4">
              <div className="flex flex-col gap-6 overflow-x-auto md:flex-row">
                <div className="flex flex-col justify-between flex-1 gap-6">
                  <div>
                    <H3 className={{ root: 'mb-4' }}>
                      {t('pwa.courses.individualLeaderboard')}
                    </H3>

                    <Leaderboard
                      courseName={course.displayName}
                      leaderboard={leaderboard || []}
                      activeParticipation={participation?.isActive}
                      onJoin={joinCourse}
                      onLeave={leaveCourse}
                      participant={participant ?? undefined}
                      onParticipantClick={openProfileModal}
                      podiumImgSrc={{
                        rank1: Rank1Img,
                        rank2: Rank2Img,
                        rank3: Rank3Img,
                      }}
                    />

                    <div className="mt-4 mb-2 text-sm text-right text-slate-600">
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
                      activeParticipation={participation?.isActive}
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
                            groupLeaderboardStatistics?.averageScore?.toFixed(
                              2
                            ),
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 text-sm text-center rounded text-slate-500 bg-slate-100">
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
                    {t('pwa.courses.awards')}
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
                                  : t('pwa.course.open')}
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

          {course?.isGamificationEnabled &&
            data.participantGroups?.map((group) => (
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
                      {!participation?.isActive && (
                        <UserNotification
                          type="warning"
                          message={t('pwa.groupActivity.joinLeaderboard')}
                        />
                      )}
                      <Leaderboard
                        courseName={course.displayName}
                        leaderboard={group.participants}
                        participant={participant}
                        activeParticipation={participation?.isActive}
                        onLeave={
                          course?.isGroupDeadlinePassed
                            ? undefined
                            : () => {
                                leaveParticipantGroup({
                                  variables: {
                                    courseId,
                                    groupId: group.id,
                                  },
                                  refetchQueries: [
                                    GetCourseOverviewDataDocument,
                                  ],
                                })

                                setSelectedTab('global')
                              }
                        }
                        hidePodium
                        podiumImgSrc={{
                          rank1: Rank1Img,
                          rank2: Rank2Img,
                          rank3: Rank3Img,
                        }}
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
                    <GroupVisualization
                      groupName={group.name}
                      participants={group.participants}
                    />
                  </div>

                  {course?.groupActivities?.length > 0 && (
                    <div className="mt-8">
                      <H4>{t('shared.generic.groupActivities')}</H4>
                      <div className="flex-col pt-2 border-t">
                        {course.groupActivities?.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex flex-row justify-between flex-1 gap-8 border-b last:border-b-0"
                          >
                            <div>
                              <div>{activity.displayName}</div>
                              <div className="text-xs">
                                {dayjs(activity.scheduledStartAt).format(
                                  'DD.MM.YYYY HH:mm'
                                )}{' '}
                                -{' '}
                                {dayjs(activity.scheduledEndAt).format(
                                  'DD.MM.YYYY HH:mm'
                                )}
                              </div>
                            </div>

                            {dayjs().isAfter(activity.scheduledEndAt) &&
                              indexedGroupActivityInstances[activity.id]
                                ?.results && (
                                <div>
                                  {typeof indexedGroupActivityInstances[
                                    activity.id
                                  ].results.points === 'number' &&
                                    typeof indexedGroupActivityInstances[
                                      activity.id
                                    ].results.maxPoints === 'number' && (
                                      <div className="text-sm">
                                        {t('shared.generic.points')}:{' '}
                                        {
                                          indexedGroupActivityInstances[
                                            activity.id
                                          ].results.points
                                        }
                                        /
                                        {
                                          indexedGroupActivityInstances[
                                            activity.id
                                          ].results.maxPoints
                                        }
                                      </div>
                                    )}

                                  {indexedGroupActivityInstances[activity.id]
                                    .results.message && (
                                    <DynamicMarkdown
                                      content={
                                        indexedGroupActivityInstances[
                                          activity.id
                                        ].results.message
                                      }
                                      className={{
                                        root: 'prose-sm prose prose-p:m-0',
                                      }}
                                    />
                                  )}
                                </div>
                              )}

                            <div>
                              {dayjs().isAfter(activity.scheduledStartAt) &&
                                dayjs().isBefore(activity.scheduledEndAt) && (
                                  <Link
                                    href={`/group/${group.id}/activity/${activity.id}`}
                                    className="inline-flex items-center gap-2 sm:hover:text-orange-700"
                                  >
                                    <Button
                                      className={{
                                        root: 'gap-4 text-left text-sm',
                                      }}
                                    >
                                      <Button.Icon>
                                        <FontAwesomeIcon
                                          icon={faExternalLink}
                                        />
                                      </Button.Icon>
                                      <Button.Label>
                                        <div>
                                          {t(
                                            'pwa.groupActivity.openGroupActivity'
                                          )}
                                        </div>
                                      </Button.Label>
                                    </Button>
                                  </Link>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Tabs.TabContent>
            ))}

          {course?.isGamificationEnabled && (
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
                    <FormikTextField
                      name="groupName"
                      placeholder={t('pwa.courses.groupName')}
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
                    <FormikNumberField
                      name="code"
                      placeholder={t('pwa.courses.code')}
                    />
                    <Button type="submit">{t('shared.generic.join')}</Button>
                  </div>
                </Form>
              </Formik>
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

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

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
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}`))
        .default,
    },
  })
}

export default CourseOverview
