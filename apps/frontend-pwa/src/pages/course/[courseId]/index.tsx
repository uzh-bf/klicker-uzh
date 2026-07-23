import { useBackgroundQuery, useMutation, useQuery } from '@apollo/client'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseGroupActivitiesDocument,
  GetCourseOverviewDataDocument,
  GetStudentCourseLeaderboardDocument,
  JoinCourseLeaderboardDocument,
  LeaveCourseLeaderboardDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Podium } from '@klicker-uzh/shared-components/src/Podium'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import {
  Button,
  H3,
  RadioGroup,
  RadioGroupItem,
  ShadcnLabel,
  TabContent,
  Tabs,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import Rank1Img from 'public/rank1.svg'
import Rank2Img from 'public/rank2.svg'
import Rank3Img from 'public/rank3.svg'
import { Suspense, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../components/Layout'
import CourseDiscussionPanel from '../../../components/course/CourseDiscussionPanel'
import SuspendedGroupView from '../../../components/course/SuspendedGroupView'
import SuspendedAssessmentResults from '../../../components/insights/assessmentResults/SuspendedAssessmentResults'
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
  const [
    isLeaveCourseLeaderboardModalOpen,
    setIsLeaveCourseLeaderboardModalOpen,
  ] = useState(false)
  const [leaderboardType, setLeaderboardType] = useState<'course' | 'biweekly'>(
    'course'
  )

  useParticipantToken({
    participantToken,
    cookiesAvailable,
  })

  const { data, loading, error } = useQuery(GetCourseOverviewDataDocument, {
    variables: { courseId },
  })

  const { data: dataLeaderboard, loading: loadingLeaderboard } = useQuery(
    GetStudentCourseLeaderboardDocument,
    {
      variables: { courseId, mode: leaderboardType },
    }
  )

  const [groupActivityQueryRef, { subscribeToMore: subscribeActivityList }] =
    useBackgroundQuery(GetCourseGroupActivitiesDocument, {
      variables: { courseId },
    })

  const [joinCourseLeaderboard] = useMutation(JoinCourseLeaderboardDocument, {
    variables: { courseId },
    // refetching the leaderboard here makes sense to ensure that the participant
    // is placed correctly in the leaderboard
    refetchQueries: [
      {
        query: GetStudentCourseLeaderboardDocument,
        variables: { courseId, mode: leaderboardType },
      },
    ],
  })

  const [leaveCourseLeaderboard] = useMutation(LeaveCourseLeaderboardDocument, {
    variables: { courseId },
  })

  useEffect(() => {
    const participation = data?.getCourseOverviewData?.participation

    // if assessment is enabled, switch to the assessment results tab automatically
    if (data?.getCourseOverviewData?.course?.isAssessmentEnabled) {
      setSelectedTab('assessment-results')
    }
    // if a course description is set but gamification is not enabled or the user is not participating in the course,
    // switch to the info tab automatically
    else if (
      data?.getCourseOverviewData &&
      (!participation ||
        (!data.getCourseOverviewData?.course?.isGamificationEnabled &&
          data.getCourseOverviewData?.course?.description))
    ) {
      setSelectedTab('info')
    }
  }, [data])

  if (
    !data?.getCourseOverviewData ||
    !data.getCourseOverviewData.course ||
    loading
  ) {
    return (
      <Layout displayName={t('shared.generic.leaderboard')}>
        <Loader />
      </Layout>
    )
  }

  if (error) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const {
    course,
    participant,
    participation,
    groupLeaderboard,
    groupLeaderboardStatistics,
    inRandomGroupPool,
  } = data.getCourseOverviewData

  const filteredGroupLeaderboard = groupLeaderboard?.filter(
    (group) => group.score > 0
  )
  const courseQAAvailable =
    course.isCourseQARolloutEnabled && course.isCourseQAEnabled

  const top10Participants = dataLeaderboard?.getStudentCourseLeaderboard
    ?.leaderboard
    ? dataLeaderboard?.getStudentCourseLeaderboard?.leaderboard.map(
        (entry) => entry.participantId
      )
    : []

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

  // if the participant is not logged in and the course has no description, show a notification
  if (!participation && !course.description) {
    return (
      <Layout
        displayName={t('shared.generic.leaderboard')}
        course={course ?? undefined}
      >
        <UserNotification
          type="info"
          message={t('pwa.courses.courseOverviewOnlyWithLogin')}
        />
      </Layout>
    )
  }

  return (
    <Layout
      displayName={t('shared.generic.leaderboard')}
      course={course ?? undefined}
    >
      {course.isGamificationEnabled ||
      course.isAssessmentEnabled ||
      course.description ||
      courseQAAvailable ? (
        <>
          <div
            className={twMerge(
              'md:mx-auto md:w-full',
              courseQAAvailable ? 'md:max-w-7xl' : 'md:max-w-6xl'
            )}
          >
            <div
              className={twMerge(
                'w-full',
                courseQAAvailable &&
                  'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]'
              )}
            >
              <div className="min-w-0">
                <Tabs
                  defaultValue={
                    course.isAssessmentEnabled
                      ? 'assessment-results'
                      : course.isGamificationEnabled
                        ? 'global'
                        : 'info'
                  }
                  value={selectedTab}
                  tabs={[
                    ...(course.isGamificationEnabled
                      ? [
                          {
                            id: 'leaderboard',
                            value: 'global',
                            disabled: !participation,
                            tooltip: !participation
                              ? t(
                                  'pwa.courses.gamificationOnlyForLoggedInUsers'
                                )
                              : undefined,
                            label: participation ? (
                              t('shared.generic.leaderboard')
                            ) : (
                              <div className="flex flex-row items-center gap-2">
                                <FontAwesomeIcon
                                  icon={faLock}
                                  aria-hidden="true"
                                />
                                <span>{t('shared.generic.leaderboard')}</span>
                              </div>
                            ),
                            data: { cy: 'student-course-leaderboard-tab' },
                          },
                        ]
                      : []),
                    ...(course.description
                      ? [
                          {
                            id: 'info',
                            value: 'info',
                            label: t('pwa.courses.courseInformation'),
                            data: { cy: 'student-course-information' },
                          },
                        ]
                      : []),
                    ...(course.isAssessmentEnabled
                      ? [
                          {
                            id: 'assessment-results',
                            value: 'assessment-results',
                            label: `${t('pwa.courses.assessmentResults')}`,
                            data: { cy: `assessment-results` },
                          },
                        ]
                      : []),
                    ...(course.isGamificationEnabled
                      ? (data.participantGroups?.map((group, ix) => ({
                          id: group.id,
                          value: group.id,
                          label: `${t('shared.generic.group')} ${group.name}`,
                          data: { cy: `student-course-existing-group-${ix}` },
                        })) ?? [])
                      : []),
                    ...(course.isGamificationEnabled &&
                    course.isGroupCreationEnabled &&
                    !course.isGroupDeadlinePassed &&
                    (data.participantGroups?.length ?? 0) < 1
                      ? [
                          {
                            id: 'create',
                            value: 'create',
                            disabled: !participation,
                            tooltip: !participation
                              ? t(
                                  'pwa.courses.gamificationOnlyForLoggedInUsers'
                                )
                              : undefined,
                            label: participation ? (
                              t('pwa.courses.createJoinGroup')
                            ) : (
                              <div className="flex flex-row items-center gap-2">
                                <FontAwesomeIcon
                                  icon={faLock}
                                  aria-hidden="true"
                                />
                                <span>{t('pwa.courses.createJoinGroup')}</span>
                              </div>
                            ),
                            data: { cy: 'student-course-create-group' },
                          },
                        ]
                      : []),
                  ]}
                  onValueChange={(tab) => setSelectedTab(tab)}
                  className={{ list: 'mb-4' }}
                >
                  {course.description && (
                    <TabContent
                      key="info"
                      value="info"
                      className={{ root: 'md:px-4' }}
                    >
                      <H3 className={{ root: 'mb-4' }}>
                        {t('pwa.courses.courseInformation')}
                      </H3>
                      <DynamicMarkdown
                        withProse
                        className={{ root: 'prose-headings:mt-0 prose-p:mt-0' }}
                        content={course.description}
                      />
                    </TabContent>
                  )}

                  {course.isGamificationEnabled && (
                    <TabContent
                      key="course"
                      value="global"
                      className={{ root: 'md:px-4' }}
                    >
                      <div className="flex flex-col gap-6 overflow-x-auto md:flex-row">
                        <div className="flex w-full flex-col justify-between gap-6 md:w-1/2">
                          <div>
                            <div className="flex w-full flex-col justify-between md:flex-row">
                              <H3
                                className={{
                                  root: twMerge(
                                    participant?.id && participation?.isActive
                                      ? 'mb-1'
                                      : 'mb-4'
                                  ),
                                }}
                              >
                                {t('pwa.courses.individualLeaderboard')}
                              </H3>

                              {participant?.id && participation?.isActive && (
                                <RadioGroup
                                  value={leaderboardType}
                                  onValueChange={(newValue) =>
                                    setLeaderboardType(
                                      newValue as 'course' | 'biweekly'
                                    )
                                  }
                                  disabled={loadingLeaderboard}
                                  className="mb-3 flex flex-row justify-end gap-3 md:mt-1.5 md:flex-col md:gap-0.5"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="course"
                                      id="course"
                                      data-cy="select-course-leaderboard"
                                    />
                                    <ShadcnLabel htmlFor="course">
                                      {t('shared.generic.course')}
                                    </ShadcnLabel>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="biweekly"
                                      id="biweekly"
                                      data-cy="select-biweekly-leaderboard"
                                    />
                                    <ShadcnLabel htmlFor="biweekly">
                                      {`${t('pwa.courses.biWeekly')} (${(() => {
                                        const startDate = dayjs().subtract(
                                          14,
                                          'day'
                                        )
                                        const formatDate = (
                                          date: dayjs.Dayjs
                                        ) => date.format('DD.MM')
                                        return `${formatDate(startDate)} - ${dayjs().format('DD.MM')}`
                                      })()})`}
                                    </ShadcnLabel>
                                  </div>
                                </RadioGroup>
                              )}
                            </div>

                            {!dataLeaderboard?.getStudentCourseLeaderboard ||
                            loadingLeaderboard ? (
                              <Loader />
                            ) : (
                              <>
                                {participant?.id && participation?.isActive && (
                                  <Leaderboard
                                    leaderboard={
                                      dataLeaderboard
                                        ?.getStudentCourseLeaderboard
                                        ?.leaderboard ?? []
                                    }
                                    onJoin={() => joinCourseLeaderboard()}
                                    onLeave={() =>
                                      setIsLeaveCourseLeaderboardModalOpen(true)
                                    }
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
                                {participant?.id &&
                                  !participation?.isActive && (
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
                                          primary
                                          onClick={() =>
                                            joinCourseLeaderboard()
                                          }
                                          className={{
                                            root: 'mt-3 h-max py-1',
                                          }}
                                          data={{
                                            cy: 'student-course-join-leaderboard',
                                          }}
                                        >
                                          <Button.Label>
                                            {t.rich(
                                              'pwa.courses.joinLeaderboardCourse',
                                              {
                                                name: course.displayName,
                                                b: (text) => <b>{text}</b>,
                                              }
                                            )}
                                          </Button.Label>
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                <div className="mb-2 mt-4 text-right text-sm text-slate-600">
                                  <div>
                                    {t('shared.leaderboard.participantCount', {
                                      number:
                                        dataLeaderboard
                                          ?.getStudentCourseLeaderboard
                                          ?.leaderboardStatistics
                                          ?.participantCount,
                                    })}
                                  </div>
                                  <div>
                                    {t('shared.leaderboard.averagePoints', {
                                      number:
                                        dataLeaderboard?.getStudentCourseLeaderboard?.leaderboardStatistics?.averageScore?.toFixed(
                                          2
                                        ),
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="rounded bg-slate-100 p-2 text-center text-sm text-slate-500">
                            {t('pwa.courses.individualLeaderboardUpdate')}
                          </div>
                        </div>

                        {course.isGroupCreationEnabled && (
                          <div className="flex w-full flex-1 flex-col justify-between gap-8 md:w-1/2">
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
                                    groupLeaderboardStatistics?.participantCount ??
                                    0,
                                })}
                              </div>
                              <div>
                                {t('shared.leaderboard.averagePoints', {
                                  number:
                                    groupLeaderboardStatistics?.averageScore?.toFixed(
                                      2
                                    ) ?? 0,
                                })}
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
                                ?.filter(
                                  (award) => award.type === 'PARTICIPANT'
                                )
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
                                      award.participantGroup &&
                                        'text-orange-700'
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
                    </TabContent>
                  )}

                  {course.isAssessmentEnabled &&
                  selectedTab === 'assessment-results' ? (
                    <TabContent
                      key="assessment-results"
                      value="assessment-results"
                      className={{ root: 'md:px-4' }}
                    >
                      <Suspense fallback={<Loader />}>
                        <SuspendedAssessmentResults courseId={course.id} />
                      </Suspense>
                    </TabContent>
                  ) : null}

                  {participant &&
                    participation &&
                    course.isGamificationEnabled &&
                    data.participantGroups?.map((group) => (
                      <Suspense key={group.id} fallback={<Loader />}>
                        <SuspendedGroupView
                          group={group}
                          participation={participation}
                          participant={participant}
                          courseId={course.id}
                          maxGroupSize={course.maxGroupSize}
                          groupDeadlineDate={course.groupDeadlineDate}
                          isGroupDeadlinePassed={
                            course.isGroupDeadlinePassed ?? false
                          }
                          groupActivityQueryRef={groupActivityQueryRef}
                          setSelectedTab={setSelectedTab}
                          subscribeActivityList={subscribeActivityList}
                        />
                      </Suspense>
                    ))}

                  {course.isGamificationEnabled && (
                    <TabContent
                      key="create"
                      value="create"
                      className={{ root: 'md:px-4' }}
                    >
                      <GroupCreationActions
                        courseId={courseId}
                        setSelectedTab={setSelectedTab}
                        inRandomGroupPool={inRandomGroupPool ?? false}
                      />
                    </TabContent>
                  )}
                </Tabs>
              </div>

              {courseQAAvailable && (
                <aside
                  aria-label={t('pwa.courseQA.title')}
                  className="mt-6 min-w-0 lg:mt-0"
                  data-cy="course-overview-qa-panel"
                >
                  <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                    <CourseDiscussionPanel
                      courseId={courseId}
                      compact
                      className="mx-0 max-w-none"
                      idPrefix="course-overview-qa"
                    />
                  </div>
                </aside>
              )}
            </div>
            {isProfileModalOpen && participantId ? (
              <ParticipantProfileModal
                onClose={closeProfileModal}
                participantId={participantId}
                top10Participants={top10Participants}
              />
            ) : null}
          </div>
          {isLeaveCourseLeaderboardModalOpen && (
            <LeaveLeaderboardModal
              onClose={() => setIsLeaveCourseLeaderboardModalOpen(false)}
              onConfirm={() => {
                leaveCourseLeaderboard()
                setIsLeaveCourseLeaderboardModalOpen(false)
              }}
            />
          )}
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
  try {
    if (typeof ctx.params?.courseId !== 'string') {
      return {
        redirect: {
          destination: `${ctx.locale ? `/${ctx.locale}` : ''}/404`,
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
  } catch (error) {
    console.error('Error in getServerSideProps on course overview:', error)

    // remove the lti-token, if it is defined
    try {
      nookies.destroy(ctx, 'lti-token', {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
      })
    } catch (nookiesError) {
      console.error(nookiesError)
    }

    // redirect to lti error page with redirect back to this page
    return {
      redirect: {
        destination: `${ctx.locale ? `/${ctx.locale}` : ''}/serverError?redirectTo=${encodeURIComponent(`/${ctx.locale}/course/${ctx.params?.courseId}`)}`,
        permanent: false,
      },
    }
  }
}

export default CourseOverview
