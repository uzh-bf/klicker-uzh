import {
  faClock,
  type IconDefinition,
} from '@fortawesome/free-regular-svg-icons'
import { faCheck, faMessage, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Course,
  ObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button, Tooltip } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AssessmentBadge from '../activities/overview/AssessmentBadge'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectPermissionLevel from '../sharing/ObjectPermissionLevel'
import CourseArchiveButton from './CourseArchiveButton'
import CourseDeletionButton from './CourseDeletionButton'
import { useCourseDeletionStatus } from './CourseDeletionStatusProvider'

interface CourseListButtonProps {
  course?: Pick<
    Course,
    | 'id'
    | 'name'
    | 'color'
    | 'startDate'
    | 'endDate'
    | 'permissionLevel'
    | 'isArchived'
    | 'isManager'
    | 'isRemovable'
    | 'isAssessmentEnabled'
  >
  onClick: () => void
  icon?: IconDefinition
  label: string
  showArchiveModal?: Dispatch<
    SetStateAction<{
      open: boolean
      courseId: string | null
      isArchived: boolean
    }>
  >
  showDeletionModal?: Dispatch<
    SetStateAction<{ open: boolean; courseId: string | null }>
  >
  showRemovalModal?: Dispatch<
    SetStateAction<{
      open: boolean
      courseId: string | null
      courseName: string | null
    }>
  >
  data?: {
    cy?: string
    test?: string
  }
}

function CourseListButton({
  course,
  onClick,
  icon,
  label,
  showArchiveModal,
  showDeletionModal,
  showRemovalModal,
  data,
}: CourseListButtonProps) {
  const t = useTranslations()
  const isPast = course?.endDate
    ? dayjs(course.endDate).isBefore(dayjs())
    : false
  const courseRunning = dayjs(course?.endDate).isAfter(dayjs())
  const [activityLogOpen, setActivityLogOpen] = useState(false)
  const { isCourseDeletionActive, isCourseDeletionStatusHydrating } =
    useCourseDeletionStatus()
  const deletionActive = course ? isCourseDeletionActive(course.id) : false
  const interactionDisabled = course
    ? deletionActive || isCourseDeletionStatusHydrating
    : false

  useEffect(() => {
    if (interactionDisabled) setActivityLogOpen(false)
  }, [interactionDisabled])

  return (
    <>
      <Button
        disabled={interactionDisabled}
        className={{
          root: twMerge(
            'flex w-full flex-row justify-between rounded-md border border-solid px-3 py-2 shadow-sm',
            typeof course?.color !== 'undefined' && 'border-b-4!'
          ),
        }}
        style={{ borderBottomColor: course?.color }}
        onClick={onClick}
        data={data}
      >
        <div>
          <div className="ml-1 flex flex-row items-center gap-3">
            {icon ? <FontAwesomeIcon icon={icon} /> : null}
            <div>{label}</div>
            {typeof course?.permissionLevel !== 'undefined' &&
              course?.permissionLevel !== null &&
              course.permissionLevel !== PermissionLevel.Owner && (
                <ObjectPermissionLevel
                  objectName={course.name}
                  permissionLevel={course.permissionLevel}
                />
              )}
          </div>
          {course?.startDate && course?.endDate && (
            <div className="text-uzh-grey-100 ml-1 flex flex-row items-center gap-1.5 text-sm">
              <FontAwesomeIcon icon={faClock} />
              <div>
                {dayjs(course.startDate).format('DD.MM.YYYY').toString()} -{' '}
                {dayjs(course.endDate).format('DD.MM.YYYY').toString()}
              </div>
            </div>
          )}
        </div>
        {typeof course !== 'undefined' ? (
          <div className="flex flex-row items-center gap-2">
            <div className="flex flex-row gap-2">
              {deletionActive && (
                <span
                  className="rounded-full bg-red-700 px-2 py-0.5 text-sm font-bold text-white"
                  data-cy={`course-deletion-in-progress-${course.name}`}
                >
                  {t('manage.courseList.courseDeletionPendingBadge')}
                </span>
              )}
              {isPast && (
                <Badge className="gap-2 bg-green-700 hover:bg-green-800">
                  <FontAwesomeIcon icon={faCheck} />
                  {t('shared.generic.ended')}
                </Badge>
              )}
              {course.isAssessmentEnabled && <AssessmentBadge />}
              {course.isArchived && (
                <Badge>{t('shared.generic.archived')}</Badge>
              )}
            </div>

            <Button
              disabled={interactionDisabled}
              className={{
                root: 'h-9 w-9',
              }}
              onClick={(e) => {
                e?.stopPropagation()
                e?.preventDefault()
                setActivityLogOpen(true)
              }}
              data={{ cy: `activity-log-course-${course?.name}` }}
            >
              <Button.Icon withoutLabel icon={faMessage} />
            </Button>

            {course.isManager ? (
              <>
                {courseRunning ? (
                  <Tooltip
                    tooltip={t('manage.courseList.archiveOnlyPastCourses')}
                  >
                    <CourseArchiveButton
                      id={course.id}
                      name={course.name}
                      isArchived={course.isArchived}
                      running={courseRunning}
                      disabled={interactionDisabled}
                      showArchiveModal={showArchiveModal}
                    />
                  </Tooltip>
                ) : (
                  <CourseArchiveButton
                    id={course.id}
                    name={course.name}
                    isArchived={course.isArchived}
                    running={courseRunning}
                    disabled={interactionDisabled}
                    showArchiveModal={showArchiveModal}
                  />
                )}
                {course.isAssessmentEnabled ? (
                  <Tooltip
                    tooltip={t('manage.courseList.noDeletionAssessment')}
                  >
                    <CourseDeletionButton
                      id={course.id}
                      name={course.name}
                      showDeletionModal={showDeletionModal}
                      isAssessmentEnabled={course.isAssessmentEnabled}
                    />
                  </Tooltip>
                ) : (
                  <CourseDeletionButton
                    id={course.id}
                    name={course.name}
                    showDeletionModal={showDeletionModal}
                    isAssessmentEnabled={course.isAssessmentEnabled}
                  />
                )}
              </>
            ) : null}
            {course.isRemovable ? (
              <Button
                disabled={interactionDisabled}
                className={{
                  root: 'h-9 w-9 border-red-600 text-red-600 hover:text-red-600',
                }}
                onClick={(e) => {
                  e?.stopPropagation()
                  e?.preventDefault()
                  showRemovalModal?.({
                    open: true,
                    courseId: course.id,
                    courseName: course.name,
                  })
                }}
                data={{ cy: `remove-course-${course.name}` }}
              >
                <Button.Icon withoutLabel icon={faX} />
              </Button>
            ) : null}
          </div>
        ) : null}
      </Button>

      {course && activityLogOpen && !interactionDisabled ? (
        <ActivityLogDialog
          objectId={course.id}
          objectType={ObjectType.Course}
          open={activityLogOpen}
          onClose={() => setActivityLogOpen(false)}
        />
      ) : null}
    </>
  )
}

export default CourseListButton
