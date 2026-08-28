import { useMutation, useQuery } from '@apollo/client'
import { faCopy, faPenToSquare } from '@fortawesome/free-regular-svg-icons'
import {
  faChartPie,
  faEllipsis,
  faFilePen,
  faGear,
  faLink,
  faMessage,
  faPencil,
  faShare,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  type Course,
  GetSingleCourseDocument,
  ObjectType,
  UpdateCourseSettingsDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Dropdown, H1, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { isCourseLearningAnalyticsAvailable } from '../analytics/courseEligibility'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../sharing/ObjectSharingModalWrapper'
import { useCourseDuplicationStatus } from './CourseDuplicationStatusProvider'
import getLTIAccessLink from './getLTIAccessLink'
import CourseDuplicationModal, {
  type CourseDuplicationFormData,
} from './modals/CourseDuplicationModal'
import CourseLearningAnalyticsModal from './modals/CourseLearningAnalyticsModal'
import CourseManipulationModal, {
  type CourseManipulationFormData,
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

function courseActionMenuLabel(icon: React.ReactNode, label: string) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </span>
  )
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
  const { isSourceCourseDuplicating, startCourseDuplication } =
    useCourseDuplicationStatus()
  const learningAnalyticsEnabled = useFeatureFlag('learning-analytics')

  const [courseSettingsModal, setCourseSettingsModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [correctionsModal, setCorrectionsModal] = useState(false)
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false)
  const [duplicationModal, setDuplicationModal] = useState(false)
  const [learningAnalyticsModal, setLearningAnalyticsModal] = useState(false)
  const courseDuplicationInProgress = isSourceCourseDuplicating(course.id)

  const [updateCourseSettings] = useMutation(UpdateCourseSettingsDocument)
  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile
  const courseLearningAnalyticsEnabled =
    course.isLearningAnalyticsEnabled === true
  const courseLearningAnalyticsValid =
    course.analyticsStatus.areAnalyticsValid === true
  const hasLearningAnalyticsAccess =
    learningAnalyticsEnabled && user?.catalyst === true
  const courseLearningAnalyticsAvailable =
    hasLearningAnalyticsAccess && isCourseLearningAnalyticsAvailable(course)
  let courseLearningAnalyticsTooltip: string | undefined
  if (!learningAnalyticsEnabled) {
    courseLearningAnalyticsTooltip = t('manage.analytics.featureUnavailable')
  } else if (!user?.catalyst) {
    courseLearningAnalyticsTooltip = t('manage.analytics.catalystRequired')
  } else if (!courseLearningAnalyticsEnabled) {
    courseLearningAnalyticsTooltip = t('manage.analytics.courseDisabled')
  } else if (!courseLearningAnalyticsValid) {
    courseLearningAnalyticsTooltip = t('manage.analytics.recomputationPending')
  }

  let learningAnalyticsSettingsTooltip: string | undefined
  if (!learningAnalyticsEnabled) {
    learningAnalyticsSettingsTooltip = t('manage.analytics.featureUnavailable')
  } else if (!user?.catalyst) {
    learningAnalyticsSettingsTooltip = t('manage.analytics.catalystRequired')
  }

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

  const courseActionMenuItems = [
    ...(course.isManager && user?.privatePreview
      ? [
          {
            id: 'course-share',
            label: courseActionMenuLabel(
              <FontAwesomeIcon icon={faShare} className="h-4 w-4" />,
              t('manage.course.shareCourse')
            ),
            onClick: () => setSharingModal(true),
            data: { cy: 'course-share-button' },
          },
        ]
      : []),
    ...(course.isManager
      ? [
          {
            id: 'course-duplicate',
            label: courseActionMenuLabel(
              <FontAwesomeIcon icon={faCopy} className="h-4 w-4" />,
              t('manage.course.duplicateCourse')
            ),
            onClick: () => setDuplicationModal(true),
            data: { cy: 'course-duplicate-button' },
          },
        ]
      : []),
    {
      id: 'course-learning-analytics',
      label: courseActionMenuLabel(
        <FontAwesomeIcon icon={faChartPie} className="h-4 w-4" />,
        t('manage.course.learningAnalytics')
      ),
      onClick: (event: React.MouseEvent) => {
        if (!courseLearningAnalyticsAvailable) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        window.open(`/analytics/${course.id}/activity`, '_blank')
      },
      disabled: !courseLearningAnalyticsAvailable,
      tooltip: courseLearningAnalyticsTooltip,
      className: {
        // The disabled item remains inert, but its explanation still needs to
        // receive pointer input through the design-system tooltip trigger.
        item: !courseLearningAnalyticsAvailable
          ? 'data-disabled:pointer-events-auto'
          : undefined,
      },
      data: { cy: 'course-learning-analytics-link' },
    },
    ...(course.isManager
      ? [
          {
            id: 'course-learning-analytics-settings',
            label: courseActionMenuLabel(
              <FontAwesomeIcon icon={faGear} className="h-4 w-4" />,
              t('manage.course.learningAnalyticsSettings')
            ),
            onClick: () => setLearningAnalyticsModal(true),
            disabled: !hasLearningAnalyticsAccess,
            tooltip: learningAnalyticsSettingsTooltip,
            className: {
              item: !hasLearningAnalyticsAccess
                ? 'data-disabled:pointer-events-auto'
                : undefined,
            },
            data: { cy: 'course-learning-analytics-settings' },
          },
        ]
      : []),
    ...(course.isAssessmentEnabled && course.isManager
      ? [
          {
            id: 'assessment-course-participant-invitations',
            label: courseActionMenuLabel(
              <FontAwesomeIcon icon={faUserPlus} className="h-4 w-4" />,
              t('manage.course.participantInvitations')
            ),
            onClick: () => {
              router.push(`/courses/${course.id}/assessment/invitations`)
            },
            data: { cy: 'assessment-course-participant-invitations' },
          },
          {
            id: 'assessment-course-point-corrections',
            label: courseActionMenuLabel(
              <FontAwesomeIcon icon={faPenToSquare} className="h-4 w-4" />,
              t('manage.course.pointCorrections')
            ),
            onClick: () => setCorrectionsModal(true),
            data: { cy: 'assessment-course-point-corrections' },
          },
        ]
      : []),
    {
      id: 'course-lti-links',
      type: 'submenu' as const,
      label: courseActionMenuLabel(
        <FontAwesomeIcon icon={faLink} className="h-4 w-4" />,
        t('manage.course.ltiLinks')
      ),
      data: { cy: 'course-lti-links' },
      items: ltiDropdownItems,
    },
  ]

  return (
    <div className="flex flex-row flex-wrap items-center gap-x-4">
      <div className="min-w-0 flex-1">
        <H1
          data={{ cy: 'course-name-with-pin' }}
          className={{ root: 'min-w-0 break-words' }}
        >
          {course.name}
        </H1>
        <div className="italic">
          {t('manage.course.nParticipants', {
            number: course.numOfParticipants ?? 0,
          })}
        </div>
      </div>
      <div className="mb-2 flex min-w-0 basis-full flex-row flex-wrap items-center justify-end gap-2 sm:flex-initial sm:basis-auto">
        {course.isEditor ? (
          <Button
            basic
            onClick={() => setCourseSettingsModal(true)}
            className={{
              root: 'text-primary-100 hover:text-primary-100 h-8 text-sm',
            }}
            data={{ cy: 'course-settings-button' }}
          >
            <Button.Icon icon={faPencil} />
            <Button.Label>{t('manage.course.modifyCourse')}</Button.Label>
          </Button>
        ) : null}
        <Button
          basic
          onClick={() => setIsActivityLogOpen(true)}
          className={{
            root: 'text-primary-100 hover:text-primary-100 h-8 text-sm',
          }}
          data={{ cy: 'course-activity-log-button' }}
        >
          <Button.Icon icon={faMessage} />
          <Button.Label>{t('shared.comments.tooltip')}</Button.Label>
        </Button>
        {!course.isAssessmentEnabled && course.pinCode && (
          <QRCodePopover
            triggerStyle="primary"
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
        {course.isAssessmentEnabled && course.isManager ? (
          <Button
            primary
            className={{ root: 'h-8' }}
            onClick={() => {
              router.push(`/courses/${course.id}/assessment/results`)
            }}
            data={{ cy: 'assessment-course-results' }}
          >
            <Button.Icon icon={faFilePen} />
            <Button.Label>{t('manage.course.assessmentResults')}</Button.Label>
          </Button>
        ) : null}
        <Dropdown
          data={{ cy: 'course-actions-menu' }}
          className={{
            item: 'py-0.5 text-sm',
            viewport: 'z-20 bg-white',
            trigger: 'h-8 w-8 border-none bg-transparent p-0 text-sm',
          }}
          align="end"
          trigger={
            <>
              <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
              <span className="sr-only">
                {t('manage.course.moreCourseActions')}
              </span>
            </>
          }
          items={courseActionMenuItems}
        />
      </div>
      {duplicationModal && (
        <CourseDuplicationModal
          initialValues={course}
          isDuplicating={courseDuplicationInProgress}
          onModalClose={() => setDuplicationModal(false)}
          onSubmit={async (values: CourseDuplicationFormData, onError) => {
            const jobStarted = await startCourseDuplication({
              course,
              values,
              onError,
            })

            if (jobStarted) {
              setDuplicationModal(false)
            }

            return jobStarted
          }}
        />
      )}
      {learningAnalyticsModal && (
        <CourseLearningAnalyticsModal
          courseId={course.id}
          isEnabled={courseLearningAnalyticsEnabled}
          onClose={() => setLearningAnalyticsModal(false)}
        />
      )}
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
              onError()
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
