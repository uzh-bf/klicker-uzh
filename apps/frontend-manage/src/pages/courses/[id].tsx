import { useQuery } from '@apollo/client'
import CourseGamificationInfos from '@components/courses/CourseGamificationInfos'
import {
  faCrown,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import useEarliestLatestCourseDates from '@lib/hooks/useEarliestLatestCourseDates'
import { Prose, TabContent, Tabs } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import CourseOverviewHeader from '../../components/courses/CourseOverviewHeader'
import GroupActivityList from '../../components/courses/GroupActivityList'
import LiveQuizList from '../../components/courses/LiveQuizList'
import MicroLearningList from '../../components/courses/MicroLearningList'
import PracticeQuizList from '../../components/courses/PracticeQuizList'

function CourseOverviewPage() {
  const t = useTranslations()
  const router = useRouter()
  const [tabValue, setTabValue] = useState('liveQuizzes')
  const [gamificationTabValue, setGamificationTabValue] =
    useState('ind-leaderboard')

  const { loading, error, data } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
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

  return (
    <Layout>
      <div className="mb-2 w-full">
        <CourseOverviewHeader
          course={course}
          name={course.name}
          pinCode={course.pinCode ?? 0}
          numOfParticipants={course.numOfParticipants ?? 0}
          earliestGroupDeadline={earliestGroupDeadline}
          earliestStartDate={earliestStartDate}
          latestEndDate={latestEndDate}
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
              <Ellipsis maxLines={3}>{course.description}</Ellipsis>
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
        </div>
        <div className="grid grid-cols-2">
          <div className="whitespace-nowrap font-bold">
            {t('shared.generic.pinCode')}
          </div>
          <div className="font-mono text-red-700" data-cy="course-pin">
            {course.pinCode}
          </div>
          <div className="font-bold">{t('shared.generic.courseDuration')}</div>
          {dayjs(course.startDate).format('DD.MM.YYYY')} -{' '}
          {dayjs(course.endDate).format('DD.MM.YYYY')}
          <div className="font-bold">{t('shared.generic.gamification')}</div>
          {course.isGamificationEnabled
            ? t('shared.generic.enabled')
            : t('shared.generic.disabled')}
        </div>
        {course.isGamificationEnabled && (
          <div className="grid grid-cols-2">
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
                <div className="font-bold">{t('shared.generic.groupSize')}</div>
                2 - {course.maxGroupSize} ({course.preferredGroupSize}{' '}
                {t('shared.generic.preferred')})
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col flex-wrap gap-4 lg:flex-row">
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
            {
              id: 'tab-practiceQuizzes',
              value: 'practiceQuizzes',
              label: (
                <div className="flex flex-row items-center gap-2.5">
                  <span>{t('shared.generic.practiceQuizzes')}</span>
                  <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
                </div>
              ),
              data: { cy: 'tab-practiceQuizzes' },
            },
            {
              id: 'tab-microLearnings',
              value: 'microLearnings',
              label: (
                <div className="flex flex-row items-center gap-2.5">
                  <span>{t('shared.generic.microlearnings')}</span>
                  <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
                </div>
              ),
              data: { cy: 'tab-microLearnings' },
            },
            {
              id: 'tab-groupActivities',
              value: 'groupActivities',
              label: (
                <div className="flex flex-row items-center gap-2.5">
                  <span>{t('shared.generic.groupActivities')}</span>
                  <FontAwesomeIcon icon={faCrown} className="text-orange-400" />
                </div>
              ),
              data: { cy: 'tab-groupActivities' },
            },
          ]}
          className={{ root: 'flex-1 basis-2/3' }}
        >
          <TabContent
            key="content-liveQuizzes"
            value="liveQuizzes"
            className={{ root: 'overflow-y-auto px-0 py-1' }}
          >
            <LiveQuizList
              courseId={course.id}
              liveQuizzes={course.liveQuizzesInfo ?? []}
            />
          </TabContent>
          <TabContent
            key="content-practiceQuizzes"
            value="practiceQuizzes"
            className={{ root: 'px-0 py-1' }}
          >
            <PracticeQuizList
              courseId={course.id}
              practiceQuizzes={course.practiceQuizzesInfo ?? []}
            />
          </TabContent>
          <TabContent
            key="content-microlearnings"
            value="microLearnings"
            className={{ root: 'px-0 py-1' }}
          >
            <MicroLearningList
              courseId={course.id}
              microLearnings={course.microLearningsInfo ?? []}
            />
          </TabContent>
          <TabContent
            key="content-groupActivities"
            value="groupActivities"
            className={{ root: 'px-0 py-1' }}
          >
            <GroupActivityList
              groupActivities={course.groupActivitiesInfo ?? []}
            />
          </TabContent>
        </Tabs>

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
