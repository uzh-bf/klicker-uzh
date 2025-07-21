import { useTranslations } from 'next-intl'

function ErrorRatesLegend({
  colors,
  wrapperStyle,
}: {
  colors: {
    correct: string
    partial: string
    incorrect: string
  }
  wrapperStyle?: React.CSSProperties
}) {
  const t = useTranslations()

  return (
    <div
      className="ml-auto flex flex-row gap-6 self-end py-1"
      style={wrapperStyle}
    >
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 16,
            height: 16,
            background: colors.incorrect,
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        <span>{t('manage.analytics.errorRate')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 16,
            height: 16,
            background: colors.partial,
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        <span>{t('manage.analytics.partialRate')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 16,
            height: 16,
            background: colors.correct,
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        <span>{t('manage.analytics.correctRate')}</span>
      </div>
    </div>
  )
}

export default ErrorRatesLegend
