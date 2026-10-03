import { faFire, faSnowflake } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface StudyStreakCardProps {
  current: number
  longest: number
  freezeBalance: number
  qualifiedToday: boolean
  responsesRemainingToday?: number | null
}

function StudyStreakCard({
  current,
  longest,
  freezeBalance,
  qualifiedToday,
  responsesRemainingToday,
}: StudyStreakCardProps) {
  const t = useTranslations()
  const statusMessage =
    responsesRemainingToday === null || responsesRemainingToday === undefined
      ? t('pwa.general.studyStreakNoDailyGoal')
      : qualifiedToday || responsesRemainingToday === 0
        ? t('pwa.general.studyStreakDoneToday')
        : t('pwa.general.studyStreakKeepGoing', {
            remaining: responsesRemainingToday,
          })

  return (
    <section
      className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm"
      data-cy="study-streak-card"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <H3 className={{ root: 'mb-1 flex items-center gap-2 text-lg' }}>
            <FontAwesomeIcon
              icon={faFire}
              className="text-orange-600"
              aria-hidden="true"
            />
            <span>{t('pwa.general.studyStreakCard')}</span>
          </H3>
          <div className="text-3xl font-bold tabular-nums text-orange-700">
            {t('pwa.general.studyStreakDays', { current })}
          </div>
          <div className="mt-1 text-sm text-slate-700">{statusMessage}</div>
        </div>

        <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 md:min-w-96">
          <div className="rounded border border-orange-200 bg-white/70 p-3">
            {t('pwa.general.studyStreakLongest', { longest })}
          </div>
          <div className="flex items-center gap-2 rounded border border-orange-200 bg-white/70 p-3">
            <FontAwesomeIcon
              icon={faSnowflake}
              className="text-sky-600"
              aria-hidden="true"
            />
            <span>
              {t('pwa.general.studyStreakFreezeBalance', {
                balance: freezeBalance,
              })}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default StudyStreakCard
