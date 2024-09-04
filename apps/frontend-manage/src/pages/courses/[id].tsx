import { useQuery } from '@apollo/client'
import CourseGamificationInfos from '@components/courses/CourseGamificationInfos'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, Tabs } from '@uzh-bf/design-system'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
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
          course={course}
          name={course.name}
          pinCode={course.pinCode ?? 0}
          numOfParticipants={course.numOfParticipants ?? 0}
        />
      </div>

      <ResizablePanelGroup direction="horizontal" className="w-full">
        <ResizablePanel
          defaultSize={data?.course?.isGamificationEnabled ? 50 : 100}
        >
          <div className={twMerge('w-full')}>
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
        </ResizablePanel>
        <ResizableHandle />
        {data?.course?.isGamificationEnabled && (
          <ResizablePanel defaultSize={50}>
            <CourseGamificationInfos course={course} />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
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
