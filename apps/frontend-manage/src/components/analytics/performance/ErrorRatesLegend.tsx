import { useTranslations } from 'next-intl'
import { Legend } from 'recharts'

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
    <Legend
      payload={[
        {
          value: t('manage.analytics.errorRate'),
          color: colors.incorrect,
          type: 'rect',
        },
        {
          value: t('manage.analytics.partialRate'),
          color: colors.partial,
          type: 'rect',
        },
        {
          value: t('manage.analytics.correctRate'),
          color: colors.correct,
          type: 'rect',
        },
      ]}
      wrapperStyle={wrapperStyle ?? { top: 0, right: 0 }}
    />
  )
}

export default ErrorRatesLegend
