import { useMutation, useQuery } from '@apollo/client'
import GroupActivityTile from '@components/courses/GroupActivityTile'
import { faCrown, faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeCourseColorDocument,
  ChangeCourseDatesDocument,
  GetSingleCourseDocument,
  SessionStatus,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  ColorPicker,
  DateChanger,
  H1,
  H2,
  H3,
  Switch,
  Toast,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { sort } from 'ramda'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import CourseDescription from '../../components/courses/CourseDescription'
import MicroSessionTile from '../../components/courses/MicroSessionTile'
import PracticeQuizTile from '../../components/courses/PracticeQuizTile'
import SessionTile from '../../components/courses/SessionTile'
import CourseQRModal from '../../components/sessions/cockpit/CourseQRModal'

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
        <div className="flex flex-row items-center justify-between">
          <H1 data={{ cy: 'course-name-with-pin' }}>
            {t('manage.course.nameWithPin', {
              name: course.name,
              pin: String(course.pinCode)
                .match(/.{1,3}/g)
                ?.join(' '),
            })}
          </H1>
          <div className="flex flex-row items-center gap-4 mb-2">
            <CourseQRModal
              relativeLink={`/course/${course.id}/join?pin=${course.pinCode}`}
              triggerText={t('manage.course.joinCourse')}
              className={{ modal: 'w-[40rem]' }}
              dataTrigger={{ cy: 'course-join-button' }}
              dataModal={{ cy: 'course-join-modal' }}
              dataCloseButton={{ cy: 'course-join-modal-close' }}
            >
              <H2>{t('manage.course.joinCourse')}</H2>
              <Link
                href={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/join?pin=${course.pinCode}`}
                target="_blank"
                className="text-primary"
                legacyBehavior
                passHref
              >
                <a data-cy="link-to-pwa-course-join-page">
                  {`${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/join?pin=${course.pinCode}`}
                </a>
              </Link>

              <div className="mt-4">
                {t.rich('manage.course.requiredPin', {
                  b: (text) => <strong>{text}</strong>,
                  pin: String(course.pinCode)
                    .match(/.{1,3}/g)
                    ?.join(' '),
                })}
              </div>
            </CourseQRModal>
            <div className="italic">
              {t('manage.course.nParticipants', {
                number: course.numOfParticipants,
              })}
            </div>
          </div>
        </div>
        {course.description ? (
          descriptionEditMode ? (
            <CourseDescription
              description={course.description}
              courseId={router.query.id as string}
              submitText={t('manage.course.saveDescription')}
              setDescriptionEditMode={setDescriptionEditMode}
            />
          ) : (
            <div className="flex flex-row gap-2 border border-solid rounded border-uzh-grey-80 prose-p:mb-2 last:prose-p:mb-0 prose-p:mt-0 prose prose-sm leading-6 prose-blockquote:text-gray-500 max-w-none focus:!outline-none">
              <Markdown
                withProse
                content={course.description}
                className={{
                  root: 'w-full p-2 rounded prose-p:mt-0 prose-headings:mt-0',
                }}
                data={{ cy: 'course-description' }}
              />
              <Button
                onClick={() => setDescriptionEditMode(true)}
                className={{ root: 'h-10' }}
                data={{ cy: 'course-description-edit-button' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faPencil} />
                </Button.Icon>
              </Button>
            </div>
          )
        ) : (
          <CourseDescription
            description={course.description ?? '<br>'}
            courseId={router.query.id as string}
            submitText={t('manage.courseList.addDescription')}
            setDescriptionEditMode={setDescriptionEditMode}
          />
        )}
        <div className="flex flex-row items-center gap-8 pt-1 h-11">
          <div>
            <Switch
              disabled
              label="Gamification"
              checked={data?.course?.isGamificationEnabled}
              onCheckedChange={() => null}
            />
          </div>
          <div className="flex flex-row">
            <div className="pr-3">{t('manage.courseList.courseColor')}</div>
            <ColorPicker
              color={course.color ?? '#0028A5'}
              onSubmit={(color) =>
                changeCourseColor({ variables: { color, courseId: course.id } })
              }
              abortText={t('shared.generic.cancel')}
              submitText={t('shared.generic.save')}
              dataTrigger={{ cy: 'course-color-trigger' }}
              dataHexInput={{ cy: 'course-color-hex-input' }}
              dataSubmit={{ cy: 'course-color-submit' }}
            />
          </div>
          <DateChanger
            label={`${t('shared.generic.startDate')}:`}
            date={course.startDate}
            edit={editStartDate}
            onEdit={() => setEditStartDate(true)}
            onSave={async (date: string) => {
              if (dayjs(date).isBefore(course.endDate)) {
                const { data } = await changeCourseDates({
                  variables: {
                    courseId: course.id,
                    startDate: date + 'T00:00:00.000Z',
                  },
                })
                if (data?.changeCourseDates?.id) {
                  setDateToastSuccess(true)
                  setEditStartDate(false)
                }
              } else {
                setDateToastError(true)
              }
            }}
            data={{ cy: 'course-start-date' }}
            dataButton={{ cy: 'course-start-date-button' }}
          />
          <DateChanger
            label={`${t('shared.generic.endDate')}:`}
            date={course.endDate}
            edit={editEndDate}
            onEdit={() => setEditEndDate(true)}
            onSave={async (date: string) => {
              if (dayjs(date).isAfter(course.startDate)) {
                const { data } = await changeCourseDates({
                  variables: {
                    courseId: course.id,
                    endDate: date + 'T23:59:59.999Z',
                  },
                })
                if (data?.changeCourseDates?.id) {
                  setDateToastSuccess(true)
                  setEditEndDate(false)
                }
              } else {
                setDateToastError(true)
              }
            }}
            data={{ cy: 'course-end-date' }}
            dataButton={{ cy: 'course-end-date-button' }}
          />
          <Toast
            duration={4000}
            openExternal={dateToastSuccess}
            setOpenExternal={setDateToastSuccess}
            type="success"
          >
            {t('manage.course.changedDate')}
          </Toast>
          <Toast
            duration={4000}
            openExternal={dateToastError}
            setOpenExternal={setDateToastError}
            type="error"
          >
            {t('manage.course.dateChangeFailed')}
          </Toast>
        </div>
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
                    groupActivity={groupActivity}
                    key={groupActivity.id}
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
