import { useQuery } from '@apollo/client'
import GroupActivityList from '@components/courses/GroupActivityList'
import MicroLearningList from '@components/courses/MicroLearningList'
import PracticeQuizList from '@components/courses/PracticeQuizList'
import {
  GetSingleCourseDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, H3, Tabs } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import CourseOverviewHeader from '../../components/courses/CourseOverviewHeader'
import CourseSettings from '../../components/courses/CourseSettings'
import LiveSessionList from '../../components/courses/LiveSessionList'

function CourseOverviewPage() {
  const t = useTranslations()
  const router = useRouter()
  const [tabValue, setTabValue] = useState('liveSessions')

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

  // TODO: re-add crown icon to catalyst features (once design system allows for complex tab content)
  // <Button.Icon className={{ root: 'text-orange-400' }}>
  //    <FontAwesomeIcon icon={faCrown} size="sm" />
  // </Button.Icon>

  return (
    <Layout>
      <div className="w-full mb-4">
        <CourseOverviewHeader
          id={course.id}
          name={course.name}
          pinCode={course.pinCode ?? 0}
          numOfParticipants={course.numOfParticipants ?? 0}
        />
        <CourseSettings
          id={course.id}
          description={course.description}
          isGamificationEnabled={course.isGamificationEnabled}
          courseColor={course.color}
          startDate={course.startDate}
          endDate={course.endDate}
        />
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-2/3">
          <div className="md:mr-2">
            <H2>{t('manage.course.courseElements')}</H2>
            <Tabs
              defaultValue="liveSessions"
              value={tabValue}
              onValueChange={(newValue) => setTabValue(newValue)}
              className={{
                root: 'border border-solid rounded-t-md ',
              }}
            >
              <Tabs.TabList>
                <Tabs.Tab
                  key="tab-liveSessions"
                  value="liveSessions"
                  label={t('manage.general.sessions')}
                  className={{
                    label: twMerge(
                      'text-base',
                      tabValue === 'liveSessions' && 'font-bold'
                    ),
                  }}
                  data={{ cy: 'tab-liveSessions' }}
                />
                <Tabs.Tab
                  key="tab-practiceQuizzes"
                  value="practiceQuizzes"
                  label={t('shared.generic.practiceQuizzes')}
                  className={{
                    label: twMerge(
                      'text-base',
                      tabValue === 'practiceQuizzes' && 'font-bold'
                    ),
                  }}
                  data={{ cy: 'tab-practiceQuizzes' }}
                />
                <Tabs.Tab
                  key="tab-microLearnings"
                  value="microLearnings"
                  label={t('shared.generic.microlearnings')}
                  className={{
                    label: twMerge(
                      'text-base',
                      tabValue === 'microLearnings' && 'font-bold'
                    ),
                  }}
                  data={{ cy: 'tab-microLearnings' }}
                />
                <Tabs.Tab
                  key="tab-groupActivities"
                  value="groupActivities"
                  label={t('shared.generic.groupActivities')}
                  className={{
                    label: twMerge(
                      'text-base',
                      tabValue === 'groupActivities' && 'font-bold'
                    ),
                  }}
                  data={{ cy: 'tab-groupActivities' }}
                />
              </Tabs.TabList>
              <Tabs.TabContent
                key="content-liveSessions"
                value="liveSessions"
                className={{ root: 'px-2 py-2' }}
              >
                <LiveSessionList sessions={course.sessions ?? []} />
              </Tabs.TabContent>
              <Tabs.TabContent
                key="content-practiceQuizzes"
                value="practiceQuizzes"
                className={{ root: 'px-2 py-2' }}
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
                className={{ root: 'px-2 py-2' }}
              >
                <MicroLearningList
                  microLearnings={course.microLearnings ?? []}
                  userCatalyst={user?.userProfile?.catalyst}
                />
              </Tabs.TabContent>
              <Tabs.TabContent
                key="content-groupActivities"
                value="groupActivities"
                className={{ root: 'px-2 py-2' }}
              >
                <GroupActivityList
                  groupActivities={course.groupActivities ?? []}
                  userCatalyst={user?.userProfile?.catalyst}
                />
              </Tabs.TabContent>
            </Tabs>
          </div>
        </div>
        {data?.course?.isGamificationEnabled && (
          <div className="w-full border-l md:w-1/3 md:pl-2">
            <H3>{t('manage.course.courseLeaderboard')}</H3>
            <Leaderboard
              className={{ root: 'max-h-[31rem] overflow-y-scroll' }}
              leaderboard={course.leaderboard ?? []}
            />
            <div className="mt-2 text-sm italic text-right text-gray-500">
              <div>
                {t('manage.course.participantsLeaderboard', {
                  number: course.numOfActiveParticipants,
                })}
                /{course.numOfParticipants}
              </div>
              <div>
                {t('manage.course.avgPoints', {
                  points: course.averageActiveScore?.toFixed(2),
                })}
              </div>
            </div>
          </div>
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
