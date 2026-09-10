import {
  faClock,
  faTrashCan,
  type IconDefinition,
} from '@fortawesome/free-regular-svg-icons'
import {
  faArchive,
  faCheck,
  faEllipsis,
  faInbox,
  faMessage,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type Course,
  ObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { Badge, Button, Dropdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type Dispatch, type SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AssessmentBadge from '../activities/overview/AssessmentBadge'
import IconActionTooltip from '../elements/IconActionTooltip'
import ActivityLogDialog from '../sharing/ActivityLogDialog'
import ObjectPermissionLevel from '../sharing/ObjectPermissionLevel'

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
  onClick?: () => void
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

  if (!course) {
    return (
      <Button
        className={{
          root: 'flex w-full flex-row justify-between rounded-md border border-solid px-3 py-2 shadow-sm',
        }}
        onClick={onClick}
        data={data}
      >
        <div>
          <div className="ml-1 flex flex-row items-center gap-3">
            {icon ? <FontAwesomeIcon icon={icon} /> : null}
            <div>{label}</div>
          </div>
        </div>
      </Button>
    )
  }

  const commentsLabel = t('shared.comments.tooltip')
  const moreActionsLabel = t('manage.course.moreCourseActions')
  const courseActionMenuItems = [
    ...(course.isManager
      ? [
          {
            id: 'archive-course',
            label: (
              <span className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={course.isArchived ? faInbox : faArchive}
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                <span>
                  {t(
                    course.isArchived
                      ? 'manage.courseList.unarchiveCourse'
                      : 'manage.courseList.archiveCourse'
                  )}
                </span>
              </span>
            ),
            onClick: () => {
              showArchiveModal?.({
                open: true,
                courseId: course.id,
                isArchived: course.isArchived,
              })
            },
            disabled: courseRunning,
            tooltip: courseRunning
              ? t('manage.courseList.archiveOnlyPastCourses')
              : undefined,
            className: {
              item: courseRunning
                ? 'data-disabled:pointer-events-auto'
                : undefined,
            },
            data: { cy: `archive-course-${course.name}` },
          },
          {
            id: 'delete-course',
            label: (
              <span className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faTrashCan}
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                <span>{t('manage.courseList.deleteCourse')}</span>
              </span>
            ),
            onClick: () => {
              showDeletionModal?.({ open: true, courseId: course.id })
            },
            disabled: course.isAssessmentEnabled,
            tooltip: course.isAssessmentEnabled
              ? t('manage.courseList.noDeletionAssessment')
              : undefined,
            className: {
              item: twMerge(
                'text-red-600 hover:text-red-600',
                course.isAssessmentEnabled &&
                  'data-disabled:pointer-events-auto'
              ),
            },
            data: { cy: `delete-course-${course.name}` },
          },
        ]
      : []),
    ...(course.isRemovable
      ? [
          {
            id: 'remove-course',
            label: (
              <span className="flex items-center gap-2">
                <FontAwesomeIcon
                  icon={faX}
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                <span>{t('manage.course.removeCourse')}</span>
              </span>
            ),
            onClick: () => {
              showRemovalModal?.({
                open: true,
                courseId: course.id,
                courseName: course.name,
              })
            },
            className: {
              item: 'text-red-600 hover:text-red-600',
            },
            data: { cy: `remove-course-${course.name}` },
          },
        ]
      : []),
  ]

  return (
    <>
      <div
        className={twMerge(
          'flex w-full flex-row justify-between rounded-md border border-solid px-3 py-2 shadow-sm',
          typeof course.color !== 'undefined' && 'border-b-4!'
        )}
        style={{ borderBottomColor: course?.color }}
      >
        <div className="min-w-0 flex-1">
          <div className="ml-1 flex flex-row items-center gap-3">
            {icon ? <FontAwesomeIcon icon={icon} /> : null}
            <Link
              href={`/courses/${course.id}`}
              className="text-primary-100 min-w-0 break-all hover:underline focus:outline-none focus-visible:underline"
              data-cy={data?.cy}
              data-test={data?.test}
            >
              {label}
            </Link>
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
        <div className="flex shrink-0 flex-row items-center gap-2">
          <div className="flex flex-row gap-2">
            {isPast && (
              <Badge className="gap-2 bg-green-700 hover:bg-green-800">
                <FontAwesomeIcon icon={faCheck} />
                {t('shared.generic.ended')}
              </Badge>
            )}
            {course.isAssessmentEnabled && <AssessmentBadge />}
            {course.isArchived && <Badge>{t('shared.generic.archived')}</Badge>}
          </div>

          <IconActionTooltip label={commentsLabel}>
            <Button
              aria-label={commentsLabel}
              className={{
                root: 'h-9 w-9',
              }}
              onClick={(e) => {
                e?.stopPropagation()
                e?.preventDefault()
                setActivityLogOpen(true)
              }}
              data={{ cy: `activity-log-course-${course.name}` }}
            >
              <Button.Icon withoutLabel icon={faMessage} />
            </Button>
          </IconActionTooltip>

          {courseActionMenuItems.length > 0 ? (
            <IconActionTooltip label={moreActionsLabel}>
              <Dropdown
                data={{ cy: `course-list-actions-${course.name}` }}
                className={{
                  item: 'py-0.5 text-sm',
                  viewport: 'z-20 bg-white',
                  trigger: 'h-9 w-9 border-none bg-transparent p-0 text-sm',
                }}
                align="end"
                trigger={
                  <>
                    <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
                    <span className="sr-only">{moreActionsLabel}</span>
                  </>
                }
                items={courseActionMenuItems}
              />
            </IconActionTooltip>
          ) : null}
        </div>
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
