import { useMutation, useQuery } from '@apollo/client'
import {
  faChartPie,
  faLink,
  faMessage,
  faPencil,
  faShare,
} from '@fortawesome/free-solid-svg-icons'
import {
  Course,
  GetSingleCourseDocument,
  ObjectType,
  UpdateCourseSettingsDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Dropdown,
  H1,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../sharing/ObjectSharingModalWrapper'
import getLTIAccessLink from './getLTIAccessLink'
import CourseManipulationModal, {
  CourseManipulationFormData,
} from './modals/CourseManipulationModal'
import QRCodePopover from './QRCodePopover'

interface CourseOverviewHeaderProps {
  course: Omit<
    Course,
    'leaderboard' | 'liveQuizzes' | 'practiceQuizzes' | 'microLearnings'
  >
  earliestGroupDeadline?: string
  earliestStartDate?: string
  latestEndDate?: string
}

function CourseOverviewHeader({
  course,
  earliestGroupDeadline,
  earliestStartDate,
  latestEndDate,
}: CourseOverviewHeaderProps) {
  const t = useTranslations()

  const [courseSettingsModal, setCourseSettingsModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false)

  const [updateCourseSettings] = useMutation(UpdateCourseSettingsDocument)
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  const onSuccessToast = () =>
    toast({
      type: 'success',
      message: t('manage.course.linkLTICopied'),
    })

  return (
    <div className="flex flex-row flex-wrap items-center justify-between">
      <H1
        data={{ cy: 'course-name-with-pin' }}
        className={{ root: 'flex-1 whitespace-nowrap' }}
      >
        {course.name}
      </H1>
      <div className="mb-2 flex flex-row items-center gap-3">
        <div className="italic">
          {t('manage.course.nParticipants', {
            number: course.numOfParticipants ?? 0,
          })}
        </div>
        {course.isEditor ? (
          <Button
            onClick={() => setCourseSettingsModal(true)}
            className={{ root: 'h-8' }}
            data={{ cy: 'course-settings-button' }}
          >
            <Button.Icon icon={faPencil} />
            <Button.Label>{t('manage.course.modifyCourse')}</Button.Label>
          </Button>
        ) : null}
        {course.isManager && user?.privatePreview ? (
          <Button
            onClick={() => setSharingModal(true)}
            className={{ root: 'h-8' }}
            data={{ cy: 'course-share-button' }}
          >
            <Button.Icon icon={faShare} />
            <Button.Label>{t('manage.course.shareCourse')}</Button.Label>
          </Button>
        ) : null}
        {user?.privatePreview ? (
          <Button
            onClick={() => setIsActivityLogOpen(true)}
            className={{ root: 'h-8' }}
            data={{ cy: 'course-activity-log-button' }}
          >
            <Button.Icon icon={faMessage} />
            <Button.Label>{t('shared.comments.tooltip')}</Button.Label>
          </Button>
        ) : null}
        <QRCodePopover
          triggerStyle="button"
          triggerText={t('manage.course.joinCourse')}
          infoComponent={
            <UserNotification
              message={t('manage.course.courseQRDescription')}
              className={{ root: 'mb-3 w-80' }}
            />
          }
          relHref={`/course/${course.id}/join?pin=${course.pinCode}`}
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
              item: 'p-1 hover:bg-gray-200',
              viewport: 'z-10 bg-white',
              trigger: 'h-8',
            }}
            trigger={
              <>
                <Button.Icon icon={faLink} />
                <Button.Label>{t('manage.course.ltiLinks')}</Button.Label>
              </>
            }
            items={[
              user?.catalyst
                ? [
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}`,
                      onSuccess: onSuccessToast,
                      t,
                      name: course.name,
                      label: t('manage.course.linkLTILeaderboardLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/docs`,
                      onSuccess: onSuccessToast,
                      t,
                      name: course.name,
                      label: t('manage.course.linkLTIDocsLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/liveQuizzes`,
                      onSuccess: onSuccessToast,
                      t,
                      name: course.name,
                      label: t('manage.course.linkLTILiveQuizzesLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/practiceQuizzes`,
                      onSuccess: onSuccessToast,
                      t,
                      name: course.name,
                      label: t('manage.course.linkLTIPracticeQuizzesLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/microLearnings`,
                      onSuccess: onSuccessToast,
                      t,
                      name: course.name,
                      label: t('manage.course.linkLTIMicroLearningsLabel'),
                    }),
                    getLTIAccessLink({
                      href: `${process.env.NEXT_PUBLIC_PWA_URL}/createAccount`,
                      onSuccess: onSuccessToast,
                      t,
                      name: course.name,
                      label: t('manage.course.linkLTIAccountManagement'),
                    }),
                  ]
                : [],
            ].flat()}
          />
        )}
      </div>

      {courseSettingsModal && (
        <CourseManipulationModal
          initialValues={course}
          earliestGroupDeadline={earliestGroupDeadline}
          earliestStartDate={earliestStartDate}
          latestEndDate={latestEndDate}
          onModalClose={() => setCourseSettingsModal(false)}
          onSubmit={async (
            values: CourseManipulationFormData,
            setSubmitting,
            onError
          ) => {
            try {
              // convert dates to UTC
              const startDateUTC = dayjs(values.startDate).utc().toISOString()
              const endDateUTC = dayjs(values.endDate).utc().toISOString()
              const groupDeadlineDateUTC = dayjs(values.groupCreationDeadline)
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
                  notificationEmail: values.notificationEmail,
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
                onError()
                setSubmitting(false)
              }
            } catch (error) {
              onError()
              setSubmitting(false)
              console.log(error)
            }
          }}
        />
      )}

      {sharingModal && course.isManager ? (
        <ObjectSharingModalWrapper
          objectUuid={course.id}
          objectName={course.name}
          objectType={ObjectType.Course}
          isOwner={course.isOwner ?? false}
          onClose={() => setSharingModal(false)}
        />
      ) : null}

      {isActivityLogOpen && (
        <ActivityLogDialog
          objectId={course.id}
          objectType={ObjectType.Course}
          open={isActivityLogOpen}
          onClose={() => setIsActivityLogOpen(false)}
        />
      )}
    </div>
  )
}

export default CourseOverviewHeader
