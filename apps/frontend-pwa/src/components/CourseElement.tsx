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
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
  const isFuture = dayjs(course.startDate).isAfter(dayjs())
  const isPast = dayjs().isAfter(course.endDate)

  return (
    <div key={course.id} className="flex w-full flex-row">
      <LinkButton
        disabled={disabled}
        icon={(isFuture && faCalendar) || (isPast && faCheck) || faBolt}
        className={{
          root: twMerge(
            'h-full flex-1 rounded-r-none border-r-0',
            isPast && 'text-slate-600',
            disabled && 'text-slate-600 hover:bg-slate-200'
          ),
        }}
        href={disabled ? '' : `/course/${course.id}`}
        data={{ cy: `course-button-${course.displayName}` }}
      >
        <div>
          <div>{course.displayName}</div>
          <div className="flex flex-row items-end justify-between">
            <div className="text-xs">
              {isFuture &&
                t('shared.generic.startAt', {
                  time: dayjs(course.startDate).local().format('DD.MM.YYYY'),
                })}
              {isPast &&
                t('shared.generic.finishedAt', {
                  time: dayjs(course.endDate).local().format('DD.MM.YYYY'),
                })}
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
                ? 'border-slate-400 bg-slate-400'
                : 'border-slate-600 bg-slate-600',
              !course.isSubscribed && !pushDisabled && 'cursor-pointer'
            ),
          }}
          disabled={!!pushDisabled}
          onClick={() => {
            if (disabled) return
            onSubscribeClick(course.isSubscribed, course.id)
          }}
          data={{ cy: `course-${course.displayName}-subscribe` }}
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
