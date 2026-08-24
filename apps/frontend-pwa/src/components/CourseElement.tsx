import { faCalendar } from '@fortawesome/free-regular-svg-icons'
import { faBolt, faCheck, faFire } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import dayjs from 'dayjs'
import { useLocale, useTranslations } from 'next-intl'
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
    isGamificationEnabled: boolean
    isLeaderboardParticipant: boolean
    studyStreakCurrent: number
  }
  pushDisabled?: boolean
  onSubscribeClick?: (subscribed: boolean, courseId: string) => void
}

function CourseElement({ disabled, course }: CourseElementProps) {
  const locale = useLocale()
  const t = useTranslations()
  const isFuture = dayjs(course.startDate).isAfter(dayjs())
  const isPast = dayjs().isAfter(course.endDate)
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Zurich',
    }).format(new Date(date))

  return (
    <div key={course.id} className="flex w-full flex-row items-stretch">
      <LinkButton
        disabled={disabled}
        icon={(isFuture && faCalendar) || (isPast && faCheck) || faBolt}
        className={{
          root: twMerge(
            'h-full flex-1',
            // !!onSubscribeClick && 'rounded-r-none border-r-0',
            isPast && 'text-slate-600',
            disabled && 'text-slate-600 hover:bg-slate-200'
          ),
        }}
        href={disabled ? '' : `/course/${course.id}`}
        data={{ cy: `course-button-${course.displayName}` }}
      >
        <div>
          <div>{course.displayName}</div>
          <div className="flex flex-col gap-0.5 text-xs text-slate-600">
            <div>
              {t('shared.generic.startAt', {
                time: formatDate(course.startDate),
              })}
            </div>
            <div>
              {t('shared.generic.endAt', {
                time: formatDate(course.endDate),
              })}
            </div>
            {course.isGamificationEnabled &&
              course.isLeaderboardParticipant && (
                <div
                  className="mt-1 flex items-center gap-1 font-medium text-orange-700"
                  data-cy={`course-study-streak-${course.id}`}
                >
                  <FontAwesomeIcon icon={faFire} aria-hidden="true" />
                  <span>
                    {t('pwa.general.studyStreakDays', {
                      current: course.studyStreakCurrent,
                    })}
                  </span>
                </div>
              )}
          </div>
        </div>
      </LinkButton>
      {/* // TODO: re-introduce icon for push notifications once they have been fixed */}
      {/* {onSubscribeClick && (
        <div className="self-stretch">
          <Button
            className={{
              root: twMerge(
                'rounded-l-none! h-full p-3',
                pushDisabled
                  ? 'border-slate-400 bg-slate-400 hover:bg-slate-500'
                  : 'border-slate-600 bg-slate-600 hover:bg-slate-500',
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
              <FontAwesomeIcon
                icon={faBellSlash}
                fixedWidth
                flip="horizontal"
                className="text-red-500"
              />
            )}
          </Button>
        </div>
      )} */}
    </div>
  )
}

export default CourseElement
