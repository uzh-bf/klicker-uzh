import { faClock, IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { faCheck, faMessage, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Course,
  ObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button, Tooltip } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AssessmentBadge from '../activities/overview/AssessmentBadge'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectPermissionLevel from '../sharing/ObjectPermissionLevel'
import CourseArchiveButton from './CourseArchiveButton'
import CourseDeletionButton from './CourseDeletionButton'

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

  return (
    <>
      <div
        className={twMerge(
          'flex w-full min-w-0 flex-row items-stretch rounded-md border border-solid shadow-sm',
          typeof course?.color !== 'undefined' && 'border-b-4!'
        )}
        style={{ borderBottomColor: course?.color }}
      >
        <button
          type="button"
          className={twMerge(
            'focus-visible:outline-primary-80 flex min-w-0 flex-1 cursor-pointer flex-row items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            typeof course !== 'undefined' && 'rounded-r-none'
          )}
          onClick={onClick}
          data-cy={data?.cy}
          data-test={data?.test}
        >
          <div className="min-w-0">
            <div className="ml-1 flex min-w-0 flex-row items-center gap-3">
              {icon ? <FontAwesomeIcon icon={icon} /> : null}
              <div className="min-w-0 break-words">{label}</div>
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
            <div className="ml-2 flex shrink-0 flex-row gap-2">
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
          ) : null}
        </button>
        {typeof course !== 'undefined' ? (
          <div
            className="flex shrink-0 flex-row items-center gap-2 px-3 py-2"
            data-cy={`course-row-actions-${course.id}`}
          >
            <Button
              className={{
                root: 'h-9 w-9',
              }}
              onClick={() => setActivityLogOpen(true)}
              aria-label={t('shared.comments.tooltip')}
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
                      showArchiveModal={showArchiveModal}
                    />
                  </Tooltip>
                ) : (
                  <CourseArchiveButton
                    id={course.id}
                    name={course.name}
                    isArchived={course.isArchived}
                    running={courseRunning}
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
                className={{
                  root: 'h-9 w-9 border-red-600 text-red-600 hover:text-red-600',
                }}
                onClick={() => {
                  showRemovalModal?.({
                    open: true,
                    courseId: course.id,
                    courseName: course.name,
                  })
                }}
                aria-label={t('manage.course.removeCourse')}
                data={{ cy: `remove-course-${course.name}` }}
              >
                <Button.Icon withoutLabel icon={faX} />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {course && activityLogOpen ? (
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
