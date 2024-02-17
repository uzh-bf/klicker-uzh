import { useMutation, useQuery } from '@apollo/client'
import CourseOverviewHeader from '@components/course/CourseOverviewHeader'
import CourseSettings from '@components/course/CourseSettings'
import GroupActivityTile from '@components/courses/GroupActivityTile'
import { faCrown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeCourseColorDocument,
  ChangeCourseDatesDocument,
  GetSingleCourseDocument,
  SessionStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { sort } from 'ramda'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import MicroSessionTile from '../../components/courses/MicroSessionTile'
import PracticeQuizTile from '../../components/courses/PracticeQuizTile'
import SessionTile from '../../components/courses/SessionTile'

function CourseOverviewPage() {
  const t = useTranslations()
  const router = useRouter()

  const [descriptionEditMode, setDescriptionEditMode] = useState(false)
  const [editStartDate, setEditStartDate] = useState(false)
  const [editEndDate, setEditEndDate] = useState(false)
  const [dateToastSuccess, setDateToastSuccess] = useState(false)
  const [dateToastError, setDateToastError] = useState(false)

  const { loading, error, data } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
  })
  const { data: user } = useQuery(UserProfileDocument)

  const [changeCourseColor] = useMutation(ChangeCourseColorDocument)
  const [changeCourseDates] = useMutation(ChangeCourseDatesDocument)

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

  const sortingOrderSessions: Record<string, number> = {
    [SessionStatus.Running]: 0,
    [SessionStatus.Scheduled]: 1,
    [SessionStatus.Prepared]: 2,
    [SessionStatus.Completed]: 3,
  }

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
          <div className="mb-4">
            <H3>{t('manage.general.sessions')}</H3>
            {course.sessions && course.sessions.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-auto sm:flex-row">
                {sort((a, b) => {
                  return (
                    sortingOrderSessions[a.status] -
                    sortingOrderSessions[b.status]
                  )
                }, course.sessions).map((session) => (
                  <SessionTile session={session} key={session.id} />
                ))}
              </div>
            ) : (
              <div>{t('manage.course.noSessions')}</div>
            )}
          </div>
          <div className="mb-4">
            <H3 className={{ root: 'flex flex-row gap-3' }}>
              <div>{t('shared.generic.practiceQuizzes')}</div>
              <Button.Icon className={{ root: 'text-orange-400' }}>
                <FontAwesomeIcon icon={faCrown} size="sm" />
              </Button.Icon>
            </H3>
            {course.practiceQuizzes && course.practiceQuizzes.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-auto sm:flex-row">
                {course.practiceQuizzes.map((quiz) => (
                  <PracticeQuizTile
                    courseId={course.id}
                    practiceQuiz={quiz}
                    key={quiz.id}
                  />
                ))}
              </div>
            ) : user?.userProfile?.catalyst ? (
              <div>{t('manage.course.noPracticeQuizzes')}</div>
            ) : (
              <UserNotification className={{ root: 'mr-3' }}>
                {t.rich('manage.general.catalystRequired', {
                  link: () => (
                    <a
                      target="_blank"
                      href="https://www.klicker.uzh.ch/catalyst"
                      className="underline"
                    >
                      www.klicker.uzh.ch/catalyst
                    </a>
                  ),
                })}
              </UserNotification>
            )}
          </div>
          <div className="mb-4">
            <H3 className={{ root: 'flex flex-row gap-3' }}>
              <div>{t('shared.generic.microlearnings')}</div>
              <Button.Icon className={{ root: 'text-orange-400' }}>
                <FontAwesomeIcon icon={faCrown} size="sm" />
              </Button.Icon>
            </H3>
            {course.microSessions && course.microSessions.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-auto sm:flex-row">
                {course.microSessions.map((microSession) => (
                  <MicroSessionTile
                    microSession={microSession}
                    key={microSession.id}
                  />
                ))}
              </div>
            ) : user?.userProfile?.catalyst ? (
              <div>{t('manage.course.noMicrolearnings')}</div>
            ) : (
              <UserNotification className={{ root: 'mr-3' }}>
                {t.rich('manage.general.catalystRequired', {
                  link: () => (
                    <a
                      target="_blank"
                      href="https://www.klicker.uzh.ch/catalyst"
                      className="underline"
                    >
                      www.klicker.uzh.ch/catalyst
                    </a>
                  ),
                })}
              </UserNotification>
            )}
          </div>
          <div className="mb-4">
            <H3 className={{ root: 'flex flex-row gap-3' }}>
              <div>{t('shared.generic.groupActivities')}</div>
              <Button.Icon className={{ root: 'text-orange-400' }}>
                <FontAwesomeIcon icon={faCrown} size="sm" />
              </Button.Icon>
            </H3>
            {course.groupActivities && course.groupActivities.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-auto sm:flex-row">
                {course.groupActivities.map((groupActivity) => (
                  <GroupActivityTile
                    key={groupActivity.id}
                    groupActivity={groupActivity}
                  />
                ))}
              </div>
            ) : user?.userProfile?.catalyst ? (
              <div>{t('manage.course.noGroupActivities')}</div>
            ) : (
              <UserNotification className={{ root: 'mr-3' }}>
                {t.rich('manage.general.catalystRequired', {
                  link: () => (
                    <a
                      target="_blank"
                      href="https://www.klicker.uzh.ch/catalyst"
                      className="underline"
                    >
                      www.klicker.uzh.ch/catalyst
                    </a>
                  ),
                })}
              </UserNotification>
            )}
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
