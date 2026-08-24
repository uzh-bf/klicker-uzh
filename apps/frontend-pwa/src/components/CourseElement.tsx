import { faCalendar } from '@fortawesome/free-regular-svg-icons'
import {
  faBolt,
  faCheck,
  faFire,
  faSnowflake,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import dayjs from 'dayjs'
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
    isGamificationEnabled: boolean
    isLeaderboardParticipant: boolean
    studyStreakCurrent: number
    studyStreakQualifiedToday: boolean
    studyStreakResponsesRemainingToday?: number | null
    studyStreakFreezeBalance: number
  }
  pushDisabled?: boolean
  onSubscribeClick?: (subscribed: boolean, courseId: string) => void
}

function CourseElement({ disabled, course }: CourseElementProps) {
  const t = useTranslations()
  const isFuture = dayjs(course.startDate).isAfter(dayjs())
  const isPast = dayjs().isAfter(course.endDate)
  const isStreakVisible =
    course.isGamificationEnabled && course.isLeaderboardParticipant
  const remaining = course.studyStreakResponsesRemainingToday
  const remainingValue = remaining ?? 0
  const streakStatus =
    isStreakVisible && remaining !== null && remaining !== undefined
      ? course.studyStreakQualifiedToday || remaining === 0
        ? 'secured'
        : course.studyStreakCurrent > 0 && course.studyStreakFreezeBalance === 0
          ? 'atRisk'
          : course.studyStreakCurrent > 0 && remaining <= 2
            ? 'keepGoing'
            : course.studyStreakCurrent === 0
              ? 'start'
              : null
      : null
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('de-CH', {
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
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0">
            <div>{course.displayName}</div>
            <div className="whitespace-nowrap text-xs text-slate-500">
              {formatDate(course.startDate)} - {formatDate(course.endDate)}
            </div>
          </div>
          {isStreakVisible && (
            <div
              className="flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-orange-700"
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
        {streakStatus && (
          <div
            className={twMerge(
              'mt-1 flex items-center gap-1 text-left text-xs',
              streakStatus === 'atRisk'
                ? 'font-medium text-orange-700'
                : 'text-slate-600'
            )}
            data-cy={`course-study-streak-status-${course.id}`}
          >
            {streakStatus === 'atRisk' && (
              <FontAwesomeIcon icon={faSnowflake} aria-hidden="true" />
            )}
            <span>
              {streakStatus === 'secured' &&
                t('pwa.general.studyStreakDoneToday')}
              {streakStatus === 'atRisk' &&
                t('pwa.general.studyStreakNoFreezes', {
                  remaining: remainingValue,
                })}
              {streakStatus === 'keepGoing' &&
                t('pwa.general.studyStreakKeepGoing', {
                  remaining: remainingValue,
                })}
              {streakStatus === 'start' &&
                t('pwa.general.studyStreakStart', {
                  remaining: remainingValue,
                })}
            </span>
          </div>
        )}
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
