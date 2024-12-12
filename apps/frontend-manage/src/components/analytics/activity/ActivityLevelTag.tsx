import { useTranslations } from 'next-intl'

function ActivityLevelTag({ activityLevel }: { activityLevel: 1 | 2 | 3 }) {
  const t = useTranslations()

  if (activityLevel === 3) {
    return (
      <div className="w-max rounded-md border bg-green-700 px-1 py-0.5 text-white">
        {t('manage.analytics.activityLevelHigh')}
      </div>
    )
  } else if (activityLevel === 2) {
    return (
      <div className="w-max rounded-md border bg-yellow-500 px-1 py-0.5 text-white">
        {t('manage.analytics.activityLevelMedium')}
      </div>
    )
  } else {
    return (
      <div className="w-max rounded-md border bg-red-600 px-1 py-0.5 text-white">
        {t('manage.analytics.activityLevelLow')}
      </div>
    )
  }
}

export default ActivityLevelTag
