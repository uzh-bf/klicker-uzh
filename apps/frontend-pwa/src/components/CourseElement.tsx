import {
  faBell,
  faBellSlash,
  faCalendar,
} from '@fortawesome/free-regular-svg-icons'
import { faBolt, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { twMerge } from 'tailwind-merge'
import LinkButton from './common/LinkButton'

interface CourseElementProps {
  disabled?: boolean
  course: {
    id: string
    startDate: string
    endDate: string
    isSubscribed: boolean
    displayName: string
  }
  pushDisabled?: boolean
  onSubscribeClick?: (subscribed: boolean, courseId: string) => void
}

function CourseElement({
  disabled,
  course,
  pushDisabled,
  onSubscribeClick,
}: CourseElementProps) {
  dayjs.extend(utc)
  const isFuture = dayjs(course.startDate).isAfter(dayjs())
  const isPast = dayjs().isAfter(course.endDate)

  return (
    <div key={course.id} className="flex flex-row w-full">
      <LinkButton
        disabled={disabled}
        icon={(isFuture && faCalendar) || (isPast && faCheck) || faBolt}
        className={{
          root: twMerge(
            'flex-1 rounded-r-none border-r-0 h-full',
            isPast && 'text-slate-600',
            disabled && 'text-slate-600 hover:bg-slate-200'
          ),
        }}
        href={`/course/${course.id}`}
      >
        <div>
          <div>{course.displayName}</div>
          <div className="flex flex-row items-end justify-between">
            <div className="text-xs">
              {isFuture &&
                `Start am ${dayjs(course.startDate)
                  .utc()
                  .format('DD.MM.YYYY')}`}
              {isPast &&
                `Beendet am ${dayjs(course.endDate)
                  .utc()
                  .format('DD.MM.YYYY')}`}
            </div>
          </div>
        </div>
      </LinkButton>
      {onSubscribeClick && (
        <Button
          className={{
            root: twMerge(
              'rounded-l-none p-4',
              pushDisabled
                ? 'bg-slate-400 border-slate-400'
                : 'bg-slate-600 border-slate-600',
              !course.isSubscribed && !pushDisabled && 'cursor-pointer'
            ),
          }}
          disabled={course.isSubscribed || !!pushDisabled}
          onClick={() => onSubscribeClick(course.isSubscribed, course.id)}
        >
          {course.isSubscribed ? (
            <FontAwesomeIcon
              className="text-uzh-yellow-100"
              icon={faBell}
              fixedWidth
            />
          ) : (
            <FontAwesomeIcon icon={faBellSlash} fixedWidth flip="horizontal" />
          )}
        </Button>
      )}
    </div>
  )
}

export default CourseElement
