import { useQuery } from '@apollo/client'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, H3, Tabs } from '@uzh-bf/design-system'

import TableWithDownload from '@components/common/TableWithDownload'
import { TableHead } from '@uzh-bf/design-system/dist/future'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../components/Layout'
import CourseOverviewHeader from '../../components/courses/CourseOverviewHeader'
import CourseSettings from '../../components/courses/CourseSettings'
import GroupActivityList from '../../components/courses/GroupActivityList'
import LiveQuizList from '../../components/courses/LiveQuizList'
import MicroLearningList from '../../components/courses/MicroLearningList'
import PracticeQuizList from '../../components/courses/PracticeQuizList'

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

  useEffect(() => {
    if (router.query.tab) {
      setTabValue(router.query.tab as string)
    }
  }, [router.query.tab])

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
      <div className="mb-4 w-full">
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
        <div
          className={twMerge(
            'w-full',
            data?.course?.isGamificationEnabled && 'md:w-2/3'
          )}
        >
          <div className="md:mr-2">
            <H2>{t('manage.course.courseElements')}</H2>
            <Tabs
              defaultValue="liveSessions"
              value={tabValue}
              onValueChange={(newValue: string) => setTabValue(newValue)}
            >
              <Tabs.TabList>
                <Tabs.Tab
                  key="tab-liveSessions"
                  value="liveSessions"
                  label={t('manage.general.sessions')}
                  className={{
                    root: 'border border-solid',
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
                  className={{
                    root: 'border border-solid',
                    label: twMerge(
                      'text-base',
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
                      'text-base',
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
                      'text-base',
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
                className={{ root: 'px-0 py-2' }}
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
          </div>
        </div>
        {data?.course?.isGamificationEnabled && (
          <div className="w-full border-l md:w-1/3 md:pl-2">
            <H3>{t('manage.course.courseLeaderboard')}</H3>

            <div className="text-md mb-2 text-slate-600">
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

            <TableWithDownload
              head={
                <>
                  <TableHead className="w-[100px]">
                    {t('shared.leaderboard.rank')}
                  </TableHead>
                  <TableHead>{t('shared.leaderboard.username')}</TableHead>
                  {/* <TableHead>{t('shared.leaderboard.email')}</TableHead> */}
                  <TableHead>{t('shared.leaderboard.points')}</TableHead>
                </>
              }
              items={
                course.leaderboard?.map((item) => ({
                  ...item,
                  email: item.username + '@klicker.com',
                })) ?? []
              }
              onDownload={() => null}
            />
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
