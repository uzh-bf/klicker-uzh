import { useMutation, useQuery } from '@apollo/client'
import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { faChartPie, faPencil } from '@fortawesome/free-solid-svg-icons'
import {
  Course,
  GetSingleCourseDocument,
  UpdateCourseSettingsDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Dropdown,
  H1,
  Toast,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import CourseManipulationModal, {
  CourseManipulationFormData,
} from './modals/CourseManipulationModal'
import { getLTIAccessLink } from './PracticeQuizElement'
import QRCodePopover from './QRCodePopover'

interface CourseOverviewHeaderProps {
  course: Omit<
    Course,
    'leaderboard' | 'liveQuizzes' | 'practiceQuizzes' | 'microLearnings'
  >
  name: string
  pinCode: number
  numOfParticipants: number
  earliestGroupDeadline?: string
  earliestStartDate?: string
  latestEndDate?: string
}

function CourseOverviewHeader({
  course,
  name,
  pinCode,
  numOfParticipants,
  earliestGroupDeadline,
  earliestStartDate,
  latestEndDate,
}: CourseOverviewHeaderProps) {
  const t = useTranslations()
  const router = useRouter()

  const [courseSettingsModal, setCourseSettingsModal] = useState(false)
  const [copyToast, setCopyToast] = useState(false)

  const [updateCourseSettings] = useMutation(UpdateCourseSettingsDocument)
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  return (
    <div className="flex flex-row flex-wrap items-center justify-between">
      <H1
        data={{ cy: 'course-name-with-pin' }}
        className={{ root: 'flex-1 whitespace-nowrap' }}
      >
        {name}
      </H1>
      <div className="mb-2 flex flex-row items-center gap-3">
        <div className="italic">
          {t('manage.course.nParticipants', {
            number: numOfParticipants,
          })}
        </div>
        <Button
          onClick={() => setCourseSettingsModal(true)}
          className={{ root: 'h-8' }}
          data={{ cy: 'course-settings-button' }}
        >
          <Button.Icon icon={faPencil} />
          <Button.Label>{t('manage.course.modifyCourse')}</Button.Label>
        </Button>
        <QRCodePopover
          triggerStyle="button"
          triggerText={t('manage.course.joinCourse')}
          infoComponent={
            <UserNotification
              message={t('manage.course.courseQRDescription')}
              className={{ root: 'mb-3 w-80' }}
            />
          }
          relHref={`/course/${course.id}/join?pin=${pinCode}`}
          data={{ cy: `course-join-qr-code` }}
        />
        {user?.publicPreview ? (
          <Button
            primary
            onClick={() => {
              window.open(`/analytics/${course.id}/activity`, '_blank')
            }}
            className={{ root: 'h-8' }}
            data={{ cy: 'course-learning-analytics-link' }}
          >
            <Button.Icon icon={faChartPie} />
            <Button.Label>{t('manage.course.learningAnalytics')}</Button.Label>
          </Button>
        ) : null}
        {user?.catalyst && (
          <Dropdown
            data={{ cy: `course-actions-${name}` }}
            className={{
              trigger: 'px-2 py-4',
              item: 'p-1 hover:bg-gray-200',
              viewport: 'z-10 bg-white',
            }}
            trigger={t('manage.course.otherActions')}
            items={[
              user?.catalyst
                ? [
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTILeaderboardLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/docs`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTIDocsLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/liveQuizzes`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTILiveQuizzesLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/practiceQuizzes`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTIPracticeQuizzesLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/microLearnings`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTIMicroLearningsLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/createAccount`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTIAccountManagement'),
                    }),
                  ]
                : [],
            ].flat()}
            triggerIcon={faHandPointer}
          />
        )}
      </div>
      <CourseManipulationModal
        initialValues={course}
        modalOpen={courseSettingsModal}
        earliestGroupDeadline={earliestGroupDeadline}
        earliestStartDate={earliestStartDate}
        latestEndDate={latestEndDate}
        onModalClose={() => setCourseSettingsModal(false)}
        onSubmit={async (
          values: CourseManipulationFormData,
          setSubmitting,
          setShowErrorToast
        ) => {
          try {
            // convert dates to UTC
            const startDateUTC = dayjs(values.startDate + 'T00:00:00.000')
              .utc()
              .toISOString()
            const endDateUTC = dayjs(values.endDate + 'T23:59:59.999')
              .utc()
              .toISOString()
            const groupDeadlineDateUTC = dayjs(
              values.groupCreationDeadline + 'T23:59:59.999'
            )
              .utc()
              .toISOString()

            const result = await updateCourseSettings({
              variables: {
                id: course.id,
                name: values.name,
                displayName: values.displayName,
                description: values.description,
                color: values.color,
                startDate: startDateUTC,
                endDate: endDateUTC,
                isGamificationEnabled: values.isGamificationEnabled,
                isGroupCreationEnabled: values.isGroupCreationEnabled,
                groupDeadlineDate: groupDeadlineDateUTC,
              },
              refetchQueries: [
                {
                  query: GetSingleCourseDocument,
                  variables: {
                    courseId: course.id,
                  },
                },
              ],
            })

            if (result.data?.updateCourseSettings) {
              setCourseSettingsModal(false)
            } else {
              setShowErrorToast(true)
              setSubmitting(false)
            }
          } catch (error) {
            setShowErrorToast(true)
            setSubmitting(false)
            console.log(error)
          }
        }}
      />

      <Toast
        type="success"
        openExternal={copyToast}
        onCloseExternal={() => setCopyToast(false)}
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkLTICopied')}
      </Toast>
    </div>
  )
}

export default CourseOverviewHeader
