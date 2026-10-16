import { faFire } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'

interface StudyStreakProgressProps {
  current: number
  remaining: number
  qualifiedToday: boolean
}

function StudyStreakProgress({
  current,
  remaining,
  qualifiedToday,
}: StudyStreakProgressProps) {
  const t = useTranslations()
  const goalReached = qualifiedToday || remaining === 0

  return (
    <div
      className="flex items-center gap-2 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900"
      data-cy="study-streak-practice-progress"
      role="status"
    >
      <FontAwesomeIcon
        icon={faFire}
        className="text-orange-600"
        aria-hidden="true"
      />
      <span>
        {goalReached
          ? t('pwa.general.studyStreakGoalReached', { current })
          : t('pwa.general.studyStreakProgress', { current, remaining })}
      </span>
    </div>
  )
}

export default StudyStreakProgress
