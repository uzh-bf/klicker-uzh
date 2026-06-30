import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faCalendarDays,
  faCheck,
  faCrown,
  faHourglassHalf,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Badge, H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function TimelineCourseInformation({
  courseName,
  courseGamified,
  courseStart,
  courseEnd,
  totalPoints,
  totalXp,
}: {
  courseName: string
  courseGamified: boolean
  courseStart: Date | string
  courseEnd: Date | string
  totalPoints?: number | null
  totalXp: number
}) {
  const t = useTranslations()

  return (
    <div className="w-full rounded-md bg-gray-100 p-4 shadow md:w-1/2 lg:w-1/3">
      <div className="flex flex-row justify-between">
        <H3 className={{ root: 'mb-2' }}>{courseName}</H3>
        <div className="mb-2 w-max text-base">
          {(() => {
            const now = new Date()
            const start = new Date(courseStart)
            const end = new Date(courseEnd)
            if (end < now) {
              return (
                <Badge className="mt-0.5 flex w-max items-center gap-2 bg-green-200 font-semibold text-green-700 hover:bg-green-300">
                  <FontAwesomeIcon icon={faCheck} />
                  {t('pwa.insights.completed')}
                </Badge>
              )
            } else if (start > now) {
              return (
                <Badge className="mt-0.5 flex w-max items-center gap-2 bg-blue-200 font-semibold text-blue-700 hover:bg-blue-300">
                  <FontAwesomeIcon icon={faClock} />
                  {t('pwa.insights.upcoming')}
                </Badge>
              )
            } else {
              return (
                <Badge className="mt-0.5 flex w-max items-center gap-2 bg-orange-200 font-semibold text-orange-700 hover:bg-orange-300">
                  <FontAwesomeIcon icon={faHourglassHalf} />
                  {t('pwa.insights.ongoing')}
                </Badge>
              )
            }
          })()}
        </div>
      </div>
      {courseGamified && (
        <div className="mb-0.5 flex items-center text-sm text-gray-600">
          <FontAwesomeIcon
            icon={faCrown}
            className="mr-2 w-4 text-orange-400"
          />
          <span>{t('shared.generic.gamified')}</span>
        </div>
      )}
      <div className="mb-2 flex items-center text-sm text-gray-600">
        <FontAwesomeIcon icon={faCalendarDays} className="mr-2 w-4" />
        <span>
          {new Date(courseStart).toLocaleDateString('de-DE')} -{' '}
          {new Date(courseEnd).toLocaleDateString('de-DE')}
        </span>
      </div>
      <div className="text-sm">
        {courseGamified && (
          <div>{`${t('pwa.insights.totalPoints')}: ${totalPoints}`}</div>
        )}
        <div>{`${t('pwa.insights.totalXp')}: ${totalXp}`}</div>
      </div>
    </div>
  )
}

export default TimelineCourseInformation
