import { useMutation, useQuery } from '@apollo/client'
import { faCopy, faPenToSquare } from '@fortawesome/free-regular-svg-icons'
import {
  faChartPie,
  faEllipsis,
  faFilePen,
  faLink,
  faMessage,
  faPencil,
  faShare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Course,
  CreateCourseDocument,
  GetSingleCourseDocument,
  GetUserCoursesDocument,
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
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectSharingModalWrapper from '../sharing/ObjectSharingModalWrapper'
import getLTIAccessLink from './getLTIAccessLink'
import CourseDuplicationModal, {
  CourseDuplicationProgress,
  type CourseDuplicationErrorType,
  type CourseDuplicationFormData,
} from './modals/CourseDuplicationModal'
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

function getCourseDuplicationGroupSize(
  value: number | string | null | undefined,
  fallback: number
) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const COURSE_DUPLICATION_PARTIAL_FAILURE_CODE =
  'COURSE_DUPLICATION_PARTIAL_FAILURE'

function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const extensions = (error as { extensions?: { code?: unknown } }).extensions
  if (typeof extensions?.code === 'string') return extensions.code

  const graphQLErrors = (error as { graphQLErrors?: unknown[] }).graphQLErrors
  for (const graphQLError of graphQLErrors ?? []) {
    const code = getGraphQLErrorCode(graphQLError)
    if (code) return code
  }

  const errors = (error as { errors?: unknown[] }).errors
  for (const nestedError of errors ?? []) {
    const code = getGraphQLErrorCode(nestedError)
    if (code) return code
  }

  return undefined
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return String(error)
}

function getCourseDuplicationErrorType(
  error: unknown
): CourseDuplicationErrorType {
  const code = getGraphQLErrorCode(error)
  if (code === COURSE_DUPLICATION_PARTIAL_FAILURE_CODE) {
    return 'partial'
  }

  const message = getErrorMessage(error)
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('not all')) {
    return 'partial'
  }

  if (
    normalizedMessage.includes('access') ||
    normalizedMessage.includes('permission')
  ) {
    return 'access'
  }

  return 'generic'
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
  const [createCourse] = useMutation(CreateCourseDocument)

  const [courseSettingsModal, setCourseSettingsModal] = useState(false)
  const [sharingModal, setSharingModal] = useState(false)
  const [correctionsModal, setCorrectionsModal] = useState(false)
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false)
  const [duplicationModal, setDuplicationModal] = useState(false)
  const [courseDuplicationInProgress, setCourseDuplicationInProgress] =
    useState(false)

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
    ...(user?.publicPreview
      ? [
          {
            id: 'course-learning-analytics',
            label: courseActionMenuLabel(
              <FontAwesomeIcon icon={faChartPie} className="h-4 w-4" />,
              t('manage.course.learningAnalytics')
            ),
            onClick: () => {
              window.open(`/analytics/${course.id}/activity`, '_blank')
            },
            data: { cy: 'course-learning-analytics-link' },
          },
        ]
      : []),
    ...(course.isAssessmentEnabled && course.isManager
      ? [
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
            setCourseDuplicationInProgress(true)
            try {
              // convert dates to UTC
              const startDateUTC = dayjs(values.startDate).utc().toISOString()
              const endDateUTC = dayjs(values.endDate).utc().toISOString()
              const groupDeadlineDateUTC = dayjs(values.groupCreationDeadline)
                .utc()
                .toISOString()
              const maxGroupSize = getCourseDuplicationGroupSize(
                values.maxGroupSize,
                course.maxGroupSize
              )
              const preferredGroupSize = getCourseDuplicationGroupSize(
                values.preferredGroupSize,
                course.preferredGroupSize
              )

              const result = await createCourse({
                variables: {
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
                  isGamificationEnabled: course.isGamificationEnabled,
                  isGroupCreationEnabled: values.isGroupCreationEnabled,
                  groupDeadlineDate: groupDeadlineDateUTC,
                  maxGroupSize,
                  preferredGroupSize,
                  sourceCourseId: course.id,
                  duplicateLiveQuizzes: values.copyLiveQuizzes,
                  duplicatePracticeQuizzes: values.copyPracticeQuizzes,
                  duplicateMicrolearnings: values.copyMicroLearnings,
                  duplicateGroupActivities: values.copyGroupActivities,
                },
                update: (cache, { data }) => {
                  // verify that the course creation was successful
                  if (!data?.createCourse) return

                  // add the new course to the course list
                  cache.updateQuery(
                    { query: GetUserCoursesDocument },
                    (qData) => {
                      if (!qData?.userCourses) return qData

                      return {
                        userCourses: [...qData.userCourses, data.createCourse!],
                      }
                    }
                  )
                },
              })

              const duplicatedCourse = result.data?.createCourse
              const mutationError = result.errors?.[0]

              if (duplicatedCourse) {
                toast({
                  type: 'success',
                  message: t('manage.courseList.courseDuplicationSucceeded', {
                    name: duplicatedCourse.name,
                  }),
                })
                setDuplicationModal(false)
                await router.push(`/courses/${duplicatedCourse.id}`)
              } else {
                onError(
                  mutationError
                    ? getCourseDuplicationErrorType(mutationError)
                    : 'access'
                )
              }
            } catch (error) {
              onError(getCourseDuplicationErrorType(error))
              console.error(error)
            } finally {
              setCourseDuplicationInProgress(false)
            }
          }}
        />
      )}
      {courseDuplicationInProgress && !duplicationModal && (
        <div
          aria-live="polite"
          className="fixed right-4 bottom-4 z-30 w-[min(24rem,calc(100vw-2rem))]"
          data-cy="course-duplication-loading"
          role="status"
        >
          <CourseDuplicationProgress className="w-full" />
        </div>
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
