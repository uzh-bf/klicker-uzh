import { ApolloError, useMutation, useQuery } from '@apollo/client'
import { faPenToSquare } from '@fortawesome/free-regular-svg-icons'
import {
  faChartPie,
  faFilePen,
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
import { useRouter } from 'next/router'
import { useState } from 'react'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../sharing/ObjectSharingModalWrapper'
import getLTIAccessLink from './getLTIAccessLink'
import CourseManipulationModal, {
  CourseManipulationFormData,
} from './modals/CourseManipulationModal'
import PointCorrectionsModal from './PointCorrectionsModal'
import QRCodePopover from './QRCodePopover'

interface CourseOverviewHeaderProps {
  course: Omit<
    Course,
    'leaderboard' | 'liveQuizzes' | 'practiceQuizzes' | 'microLearnings'
  >
  earliestGroupDeadline?: string
  earliestStartDate?: string
  latestEndDate?: string
  containsActivities: boolean
  containsGroups: boolean
}

function CourseOverviewHeader({
  course,
  earliestGroupDeadline,
  earliestStartDate,
  latestEndDate,
  containsActivities,
  containsGroups,
}: CourseOverviewHeaderProps) {
  const t = useTranslations()
  const router = useRouter()

  const [courseSettingsModal, setCourseSettingsModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [correctionsModal, setCorrectionsModal] = useState(false)
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false)

  const [updateCourseSettings] = useMutation(UpdateCourseSettingsDocument)
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

  const ltiDropdownItems = [
    getLTIAccessLink({
      href: `${process.env.NEXT_PUBLIC_PWA_URL}/${course.language}/course/${course.id}`,
      t,
      name: course.name,
      label: t('manage.course.linkLTILeaderboardLabel'),
    }),
    getLTIAccessLink({
      href: `${process.env.NEXT_PUBLIC_PWA_URL}/${course.language}/course/${course.id}/docs`,
      t,
      name: course.name,
      label: t('manage.course.linkLTIDocsLabel'),
    }),
    getLTIAccessLink({
      href: `${process.env.NEXT_PUBLIC_PWA_URL}/${course.language}/course/${course.id}/liveQuizzes/overview`,
      t,
      name: course.name,
      label: t('manage.course.linkLTILiveQuizzesLabel'),
    }),
    getLTIAccessLink({
      href: `${process.env.NEXT_PUBLIC_PWA_URL}/${course.language}/course/${course.id}/practiceQuizzes/overview`,
      t,
      name: course.name,
      label: t('manage.course.linkLTIPracticeQuizzesLabel'),
    }),
    getLTIAccessLink({
      href: `${process.env.NEXT_PUBLIC_PWA_URL}/${course.language}/course/${course.id}/microLearnings/overview`,
      t,
      name: course.name,
      label: t('manage.course.linkLTIMicroLearningsLabel'),
    }),
    getLTIAccessLink({
      href: `${process.env.NEXT_PUBLIC_PWA_URL}/${course.language}/createAccount`,
      t,
      name: course.name,
      label: t('manage.course.linkLTIAccountManagement'),
    }),
  ]

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
        <Button
          onClick={() => setIsActivityLogOpen(true)}
          className={{ root: 'h-8' }}
          data={{ cy: 'course-activity-log-button' }}
        >
          <Button.Icon icon={faMessage} />
          <Button.Label>{t('shared.comments.tooltip')}</Button.Label>
        </Button>
        {!course.isAssessmentEnabled && course.pinCode && (
          <QRCodePopover
            triggerStyle="button"
            triggerText={t('manage.course.joinCourse')}
            infoComponent={
              <UserNotification
                message={t('manage.course.courseQRDescription')}
                className={{ root: 'mb-3 w-80' }}
              />
            }
            relHref={`/${course.language}/course/${course.id}/join?pin=${course.pinCode}`}
            data={{ cy: `course-join-qr-code` }}
          />
        )}
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
        {course.isAssessmentEnabled && course.isManager ? (
          <Button
            className={{ root: 'h-8' }}
            onClick={() => {
              router.push(`/courses/${course.id}/assessment/results`)
            }}
          >
            <Button.Icon icon={faFilePen} />
            <Button.Label>{t('manage.course.assessmentResults')}</Button.Label>
          </Button>
        ) : null}
        {course.isAssessmentEnabled && course.isManager ? (
          <Button
            onClick={() => setCorrectionsModal(true)}
            className={{ root: 'h-8' }}
            data={{ cy: 'assessment-course-point-corrections' }}
          >
            <Button.Icon icon={faPenToSquare} />
            <Button.Label>{t('manage.course.pointCorrections')}</Button.Label>
          </Button>
        ) : null}
        <Dropdown
          data={{ cy: `course-lti-links` }}
          className={{
            item: 'p-1 hover:bg-gray-200',
            viewport: 'z-10 bg-white',
            trigger: 'h-8',
          }}
          align="end"
          trigger={
            <>
              <Button.Icon icon={faLink} />
              <Button.Label>{t('manage.course.ltiLinks')}</Button.Label>
            </>
          }
          items={ltiDropdownItems}
        />
      </div>

      {courseSettingsModal && (
        <CourseManipulationModal
          initialValues={course}
          earliestGroupDeadline={earliestGroupDeadline}
          earliestStartDate={earliestStartDate}
          latestEndDate={latestEndDate}
          containsActivities={containsActivities}
          containsGroups={containsGroups}
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
                  description:
                    !values.description?.match(/^(<br>(\n)*)$/g) &&
                    values.description !== ''
                      ? values.description
                      : null,
                  language: values.language,
                  color: values.color,
                  startDate: startDateUTC,
                  endDate: endDateUTC,
                  notificationEmail: values.notificationEmail,
                  isGamificationEnabled: values.isGamificationEnabled,
                  isGroupCreationEnabled: values.isGroupCreationEnabled,
                  groupDeadlineDate: groupDeadlineDateUTC,
                },
                update: (cache, { data }) => {
                  // check if the update was successful
                  if (!data?.updateCourseSettings) return

                  // update the cached list of catalog collections
                  cache.updateQuery(
                    {
                      query: GetSingleCourseDocument,
                      variables: { courseId: course.id },
                    },
                    (qData) => {
                      if (!qData?.course) return qData

                      return {
                        course: {
                          ...qData.course,
                          ...data.updateCourseSettings!,
                        },
                      }
                    }
                  )
                },
              })

              if (result.data?.updateCourseSettings) {
                setCourseSettingsModal(false)
              } else {
                onError()
                setSubmitting(false)
              }
            } catch (error) {
              const isCorrelatedGamificationConflict =
                error instanceof ApolloError &&
                error.graphQLErrors.some(
                  (graphQLError) =>
                    graphQLError.extensions?.code ===
                    'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT'
                )
              if (isCorrelatedGamificationConflict) {
                toast({
                  type: 'error',
                  message: t(
                    'manage.courseList.gamificationCorrelatedQuizConflict'
                  ),
                  options: { duration: 6000 },
                })
              } else {
                onError()
              }
              setSubmitting(false)
              console.log(error)
            }
          }}
        />
      )}

      {course.isAssessmentEnabled && course.isManager && correctionsModal ? (
        <PointCorrectionsModal
          courseId={course.id}
          onClose={() => setCorrectionsModal(false)}
        />
      ) : null}

      {sharingModal && course.isManager ? (
        <ObjectSharingModalWrapper
          objectUuid={course.id}
          objectName={course.name}
          objectType={ObjectType.Course}
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
