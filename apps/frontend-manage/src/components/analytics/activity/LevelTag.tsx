import { useTranslations } from 'next-intl'

function LevelTag({ level }: { level: 1 | 2 | 3 }) {
  const t = useTranslations()

  if (level === 3) {
    return (
      <div className="w-max rounded-md border bg-green-700 px-1 py-0.5 text-white">
        {t('manage.analytics.levelHigh')}
      </div>
    )
  } else if (level === 2) {
    return (
      <div className="w-max rounded-md border bg-yellow-500 px-1 py-0.5 text-white">
        {t('manage.analytics.levelMedium')}
      </div>
    )
  } else {
    return (
      <div className="w-max rounded-md border bg-red-600 px-1 py-0.5 text-white">
        {t('manage.analytics.levelLow')}
      </div>
    )
  }
}

export default LevelTag
