import { useMutation, useQuery } from '@apollo/client'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeCourseColorDocument,
  ChangeCourseDatesDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import { SESSION_STATUS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  ColorPicker,
  DateChanger,
  H1,
  H2,
  H3,
  Toast,
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
import LearningElementTile from '../../components/courses/LearningElementTile'
import MicroSessionTile from '../../components/courses/MicroSessionTile'
import SessionTile from '../../components/courses/SessionTile'
import QRPopup from '../../components/sessions/cockpit/QRPopup'

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

  if (loading || !data?.course) return <div>{t('shared.generic.loading')}</div>

  const { course } = data

  const sortingOrderSessions: Record<string, number> = {
    [SESSION_STATUS.RUNNING]: 0,
    [SESSION_STATUS.SCHEDULED]: 1,
    [SESSION_STATUS.PREPARED]: 2,
    [SESSION_STATUS.COMPLETED]: 3,
  }

  return (
    <Layout>
      <div className="w-full mb-4">
        <div className="flex flex-row items-center justify-between">
          <H1>
            {t('manage.course.nameWithPin', {
              name: course.name,
              pin: String(course.pinCode)
                .match(/.{1,3}/g)
                ?.join(' '),
            })}
          </H1>
          <div className="flex flex-row items-center gap-4 mb-2">
            <QRPopup
              relativeLink={`/course/${course.id}/join?pin=${course.pinCode}`}
              triggerText={t('manage.course.joinCourse')}
              className={{ modal: 'w-[40rem]' }}
            >
              <H2>{t('manage.course.joinCourse')}</H2>
              <Link
                href={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/join?pin=${course.pinCode}`}
                target="_blank"
                className="text-primary"
              >{`${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/join?pin=${course.pinCode}`}</Link>

              <div className="mt-4">
                {t.rich('manage.course.requiredPin', {
                  b: (text) => <strong>{text}</strong>,
                  pin: String(course.pinCode)
                    .match(/.{1,3}/g)
                    ?.join(' '),
                })}
              </div>
            </QRPopup>
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
            <div className="flex flex-row gap-2 border border-solid rounded border-uzh-grey-80">
              <Markdown
                content={course.description}
                className={{ root: 'w-full p-2 rounded' }}
              />
              <Button
                onClick={() => setDescriptionEditMode(true)}
                className={{ root: 'h-10' }}
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
          <div className="flex flex-row">
            <div className="pr-3">{t('manage.courseList.courseColor')}</div>
            <ColorPicker
              color={course.color ?? '#0028A5'}
              onSubmit={(color) =>
                changeCourseColor({ variables: { color, courseId: course.id } })
              }
              abortText={t('shared.generic.cancel')}
              submitText={t('shared.generic.save')}
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
        <div className="w-full md:w-2/3 md:border-r-[0.1rem] md:border-solid md:border-uzh-grey-80">
          <div className="mb-4">
            <H3>{t('manage.general.sessions')}</H3>
            {course.sessions && course.sessions.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-scroll sm:flex-row">
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
            <H3>{t('shared.generic.learningElements')}</H3>
            {course.learningElements && course.learningElements.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-scroll sm:flex-row">
                {course.learningElements.map((learningElement) => (
                  <LearningElementTile
                    courseId={course.id}
                    learningElement={learningElement}
                    key={learningElement.id}
                  />
                ))}
              </div>
            ) : (
              <div>{t('manage.course.noLearningElements')}</div>
            )}
          </div>
          <div className="mb-4">
            <H3>{t('shared.generic.microSessions')}</H3>
            {course.microSessions && course.microSessions.length > 0 ? (
              <div className="flex flex-col gap-2 pr-4 overflow-x-scroll sm:flex-row">
                {course.microSessions.map((microSession) => (
                  <MicroSessionTile
                    microSession={microSession}
                    key={microSession.id}
                  />
                ))}
              </div>
            ) : (
              <div>{t('manage.course.noMicroSessions')}</div>
            )}
          </div>
        </div>
        <div className="w-full md:w-1/3 md:pl-2">
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
            </div>
            <div>
              {t('manage.course.avgPoints', {
                points: course.averageActiveScore?.toFixed(2),
              })}
            </div>
            <div className="mt-1">
              {t('manage.course.courseParticipants', {
                number: course.numOfParticipants,
              })}
            </div>
            <div>
              {t('manage.course.avgPoints', {
                points: course.averageScore?.toFixed(2),
              })}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (
        await import(
          `@klicker-uzh/shared-components/src/intl-messages/${locale}.json`
        )
      ).default,
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
