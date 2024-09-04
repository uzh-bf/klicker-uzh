import { useQuery } from '@apollo/client'
import CourseGamificationInfos from '@components/courses/CourseGamificationInfos'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Prose, Tabs } from '@uzh-bf/design-system'
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
  const [tabValue, setTabValue] = useState('liveSessions')
  const [gamificationTabValue, setGamificationTabValue] =
    useState('ind-leaderboard')

  const { loading, error, data } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
  })
  const { data: user } = useQuery(UserProfileDocument)

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

  const CrownIcon = () => (
    <Button.Icon className={{ root: 'text-orange-400' }}>
      <FontAwesomeIcon icon={faCrown} size="sm" />
    </Button.Icon>
  )

  return (
    <Layout>
      <div className="mb-2 w-full">
        <CourseOverviewHeader
          course={course}
          name={course.name}
          pinCode={course.pinCode ?? 0}
          numOfParticipants={course.numOfParticipants ?? 0}
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
            <Ellipsis maxLines={3}>{course.description}</Ellipsis>
          </Prose>
        </div>
        <div className="grid grid-cols-2">
          <div className="whitespace-nowrap font-bold">
            {t('shared.generic.pinCode')}
          </div>
          <div className="font-mono text-red-700">{course.pinCode}</div>
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

      <div className="mt-4 flex flex-col flex-wrap gap-4 md:flex-row">
        <Tabs
          defaultValue="liveSessions"
          value={tabValue}
          onValueChange={(newValue: string) => setTabValue(newValue)}
          className={{ root: 'flex-1 basis-2/3' }}
        >
          <Tabs.TabList>
            <Tabs.Tab
              key="tab-liveSessions"
              value="liveSessions"
              label={t('manage.general.sessions')}
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'liveSessions' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-liveSessions' }}
            />
            <Tabs.Tab
              key="tab-practiceQuizzes"
              value="practiceQuizzes"
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'practiceQuizzes' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-practiceQuizzes' }}
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <div>{t('shared.generic.practiceQuizzes')}</div>
                <CrownIcon />
              </div>
            </Tabs.Tab>
            <Tabs.Tab
              key="tab-microLearnings"
              value="microLearnings"
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'microLearnings' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-microLearnings' }}
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <div>{t('shared.generic.microlearnings')}</div>
                <CrownIcon />
              </div>
            </Tabs.Tab>
            <Tabs.Tab
              key="tab-groupActivities"
              value="groupActivities"
              className={{
                root: 'border border-solid',
                label: twMerge(
                  'whitespace-nowrap text-base',
                  tabValue === 'groupActivities' && 'font-bold'
                ),
              }}
              data={{ cy: 'tab-groupActivities' }}
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <div>{t('shared.generic.groupActivities')}</div>
                <CrownIcon />
              </div>
            </Tabs.Tab>
          </Tabs.TabList>
          <Tabs.TabContent
            key="content-liveSessions"
            value="liveSessions"
            className={{ root: 'overflow-y-auto px-0 py-2' }}
          >
            <LiveQuizList sessions={course.sessions ?? []} />
          </Tabs.TabContent>
          <Tabs.TabContent
            key="content-practiceQuizzes"
            value="practiceQuizzes"
            className={{ root: 'px-0 py-2' }}
          >
            <PracticeQuizList
              practiceQuizzes={course.practiceQuizzes ?? []}
              courseId={course.id}
              userCatalyst={user?.userProfile?.catalyst}
            />
          </Tabs.TabContent>
          <Tabs.TabContent
            key="content-microlearnings"
            value="microLearnings"
            className={{ root: 'px-0 py-2' }}
          >
            <MicroLearningList
              microLearnings={course.microLearnings ?? []}
              courseId={course.id}
              userCatalyst={user?.userProfile?.catalyst}
            />
          </Tabs.TabContent>
          <Tabs.TabContent
            key="content-groupActivities"
            value="groupActivities"
            className={{ root: 'px-0 py-2' }}
          >
            <GroupActivityList
              groupActivities={course.groupActivities ?? []}
              courseId={course.id}
              userCatalyst={user?.userProfile?.catalyst}
            />
          </Tabs.TabContent>
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
