import { useQuery } from '@apollo/client'
import CourseCalendarView from '@components/courses/CourseCalendarView'
import CourseGamificationInfos from '@components/courses/CourseGamificationInfos'
import CourseOverviewHeader from '@components/courses/CourseOverviewHeader'
import GroupActivityList from '@components/courses/GroupActivityList'
import LiveQuizList from '@components/courses/LiveQuizList'
import MicroLearningList from '@components/courses/MicroLearningList'
import PracticeQuizList from '@components/courses/PracticeQuizList'
import Layout from '@components/Layout'
import {
  faCrown,
  faList,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  ReviewStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import useEarliestLatestCourseDates from '@lib/hooks/useEarliestLatestCourseDates'
import {
  Button,
  Progress,
  Prose,
  TabContent,
  Tabs,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

function CourseOverviewPage() {
  const t = useTranslations()
  const router = useRouter()
  const [tabValue, setTabValue] = useState('liveQuizzes')
  const [gamificationTabValue, setGamificationTabValue] =
    useState('ind-leaderboard')
  const [calendarView, showCalendarView] = useState(false)
  const [highlightedActivity, setHighlightedActivity] = useState<string | null>(
    null
  )

  const { loading, error, data } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
    ssr: false,
    fetchPolicy: 'network-only', // critical query, should always be up to date
  })

  const { earliestStartDate, latestEndDate, earliestGroupDeadline } =
    useEarliestLatestCourseDates({
      activities: [
        ...(data?.course?.groupActivitiesInfo ?? []),
        ...(data?.course?.microLearningsInfo ?? []),
        ...(data?.course?.practiceQuizzesInfo ?? []),
        ...(data?.course?.liveQuizzesInfo ?? []),
      ],
    })

  useEffect(() => {
    if (data && !data.course) {
      router.push('/404')
    }
  }, [data, router])

  useEffect(() => {
    if (router.query.tab) {
      setTabValue(router.query.tab as string)
    }
  }, [router.query.tab])

  useEffect(() => {
    if (router.query.gamificationTab) {
      setGamificationTabValue(router.query.gamificationTab as string)
    }
  }, [router.query.gamificationTab])

  const { reviewCompleted, reviewCompletedModified } = useMemo(() => {
    if (!data?.course) {
      return {
        reviewCompleted: 0,
        reviewCompletedModified: 0,
      }
    }

    const allActivities = [
      ...(data.course.liveQuizzesInfo ?? []),
      ...(data.course.practiceQuizzesInfo ?? []),
      ...(data.course.microLearningsInfo ?? []),
      ...(data.course.groupActivitiesInfo ?? []),
    ]

    const totalActivities = allActivities.length
    const completedActivities = allActivities.filter(
      (quiz) => quiz.reviewStatus === ReviewStatus.Reviewed
    ).length
    const reviewCompletedModified = allActivities.filter(
      (quiz) => quiz.reviewStatus === ReviewStatus.ModifiedAfterReview
    ).length

    return {
      reviewCompleted: Math.round(
        ((completedActivities + reviewCompletedModified) / totalActivities) *
          100
      ),
      reviewCompletedModified: Math.round(
        (reviewCompletedModified / totalActivities) * 100
      ),
    }
  }, [data?.course])

  if (error) {
    return <div>{error.message}</div>
  }

  if (loading || !data?.course)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  const { course } = data

  const createAssessmentActivityTab = (
    id: string,
    value: string,
    activityType: string,
    dataCy: string
  ) => ({
    id,
    value,
    label: (
      <div className="flex flex-row items-center gap-2.5">
        <span>{activityType}</span>
        <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
      </div>
    ),
    disabled: course.isAssessmentEnabled,
    tooltip: course.isAssessmentEnabled
      ? t('manage.course.activityNotAvailableAssessment', {
          activityType,
        })
      : undefined,
    tooltipDelay: 0,
    data: { cy: dataCy },
  })

  return (
    <Layout>
      <div className="mb-2 w-full">
        <CourseOverviewHeader
          course={course}
          earliestGroupDeadline={earliestGroupDeadline}
          earliestStartDate={earliestStartDate}
          latestEndDate={latestEndDate}
          containsActivities={
            (course.liveQuizzesInfo?.length || 0) > 0 ||
            (course.practiceQuizzesInfo?.length || 0) > 0 ||
            (course.microLearningsInfo?.length || 0) > 0 ||
            (course.groupActivitiesInfo?.length || 0) > 0
          }
          containsGroups={
            !!course.numOfParticipantGroups && course.numOfParticipantGroups > 0
          }
        />
      </div>

      <div
        className={twMerge(
          'grid grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-3',
          !course.isGamificationEnabled && 'md:grid-cols-2'
        )}
      >
        <div>
          <div className="font-bold">{t('shared.generic.description')}</div>
          <Prose className={{ root: 'prose-p:m-0 prose-img:m-0' }}>
            {course.description ? (
              <Ellipsis maxLines={2}>{course.description}</Ellipsis>
            ) : (
              <div className="flex flex-row items-center gap-2">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="text-orange-600"
                />
                <div>{t('manage.course.noDescriptionNotification')}</div>
              </div>
            )}
          </Prose>
          {reviewCompleted > 0 && (
            <div className="-mt-1 flex flex-row items-center gap-4">
              <div className="whitespace-nowrap font-bold">
                {t('manage.course.reviewProgress')}
              </div>
              <Progress
                isMaxVisible={false}
                max={100}
                value={
                  reviewCompletedModified > 0
                    ? [reviewCompleted, reviewCompletedModified]
                    : [reviewCompleted]
                }
                formatter={(value) => `${value}%`}
                className={{
                  root: 'h-5 w-full',
                  indicator:
                    reviewCompletedModified > 0
                      ? ['bg-green-700', 'bg-uzh-red-100']
                      : ['bg-green-700'],
                  background: 'bg-uzh-grey-40',
                }}
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2">
          {!course.isAssessmentEnabled && course.pinCode && (
            <>
              <div className="whitespace-nowrap font-bold">
                {t('shared.generic.pinCode')}
              </div>
              <div className="font-mono text-red-700" data-cy="course-pin">
                {course.pinCode}
              </div>
            </>
          )}
          <div className="font-bold">{t('shared.generic.courseDuration')}</div>
          {dayjs(course.startDate).format('DD.MM.YYYY')} -{' '}
          {dayjs(course.endDate).format('DD.MM.YYYY')}
          <div className="line-clamp-1 font-bold">
            {t('manage.courseList.notificationEmail')}
          </div>
          {course.notificationEmail}
          <div className="font-bold">
            {t('manage.courseList.courseLanguage')}
          </div>
          {t(`shared.generic.${course.language}`)}
        </div>
        <div className="grid h-max grid-cols-2">
          <div className="font-bold">{t('shared.generic.gamification')}</div>
          {course.isGamificationEnabled
            ? t('shared.generic.enabled')
            : t('shared.generic.disabled')}
          {course.isGamificationEnabled && (
            <>
              <div className="font-bold">
                {t('manage.courseList.groupCreationEnabled')}
              </div>
              {course.isGroupCreationEnabled
                ? t('shared.generic.enabled')
                : t('shared.generic.disabled')}
              {course.isGroupCreationEnabled && (
                <>
                  <div className="font-bold">
                    {t('manage.courseList.groupCreationDeadline')}
                  </div>
                  {dayjs(course.groupDeadlineDate).format('DD.MM.YYYY')}
                  <div className="font-bold">
                    {t('shared.generic.groupSize')}
                  </div>
                  2 - {course.maxGroupSize} ({course.preferredGroupSize}{' '}
                  {t('shared.generic.preferred')})
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {calendarView ? (
          <div className="flex flex-1 basis-3/5 flex-col">
            <Button
              basic
              onClick={() => showCalendarView(false)}
              className={{
                root: 'text-primary-100 hover:text-primary-100 float-right mb-1 h-7 w-max px-2 py-0 text-sm',
              }}
            >
              <Button.Icon icon={faList} />
              <Button.Label>{t('manage.course.backToListView')}</Button.Label>
            </Button>
            <CourseCalendarView
              course={course}
              setActivityList={setTabValue}
              switchToListView={() => showCalendarView(false)}
              setHighlightedActivity={setHighlightedActivity}
            />
          </div>
        ) : (
          <Tabs
            defaultValue="liveQuizzes"
            value={tabValue}
            onValueChange={(newValue: string) => setTabValue(newValue)}
            tabs={[
              {
                id: 'tab-liveQuizzes',
                value: 'liveQuizzes',
                label: t('manage.general.liveQuizzes'),
                data: { cy: 'tab-liveQuizzes' },
              },
              createAssessmentActivityTab(
                'tab-practiceQuizzes',
                'practiceQuizzes',
                t('shared.generic.practiceQuizzes'),
                'tab-practiceQuizzes'
              ),
              createAssessmentActivityTab(
                'tab-microLearnings',
                'microLearnings',
                t('shared.generic.microlearnings'),
                'tab-microLearnings'
              ),
              createAssessmentActivityTab(
                'tab-groupActivities',
                'groupActivities',
                t('shared.generic.groupActivities'),
                'tab-groupActivities'
              ),
            ]}
            className={{ root: 'flex-1 basis-3/5' }}
          >
            <TabContent
              key="content-liveQuizzes"
              value="liveQuizzes"
              className={{ root: 'overflow-y-auto px-0 py-1' }}
            >
              <LiveQuizList
                courseId={course.id}
                courseLanguage={course.language}
                liveQuizzes={course.liveQuizzesInfo ?? []}
                openCalendarView={() => showCalendarView(true)}
                highlightedActivity={highlightedActivity}
              />
            </TabContent>
            <TabContent
              key="content-practiceQuizzes"
              value="practiceQuizzes"
              className={{ root: 'px-0 py-1' }}
            >
              <PracticeQuizList
                courseId={course.id}
                courseLanguage={course.language}
                practiceQuizzes={course.practiceQuizzesInfo ?? []}
                openCalendarView={() => showCalendarView(true)}
                highlightedActivity={highlightedActivity}
              />
            </TabContent>
            <TabContent
              key="content-microlearnings"
              value="microLearnings"
              className={{ root: 'px-0 py-1' }}
            >
              <MicroLearningList
                courseId={course.id}
                courseLanguage={course.language}
                microLearnings={course.microLearningsInfo ?? []}
                openCalendarView={() => showCalendarView(true)}
                highlightedActivity={highlightedActivity}
              />
            </TabContent>
            <TabContent
              key="content-groupActivities"
              value="groupActivities"
              className={{ root: 'px-0 py-1' }}
            >
              <GroupActivityList
                groupActivities={course.groupActivitiesInfo ?? []}
                openCalendarView={() => showCalendarView(true)}
                highlightedActivity={highlightedActivity}
              />
            </TabContent>
          </Tabs>
        )}

        {data?.course?.isGamificationEnabled && (
          <CourseGamificationInfos
            course={course}
            tabValue={gamificationTabValue}
            setTabValue={setGamificationTabValue}
          />
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default CourseOverviewPage
