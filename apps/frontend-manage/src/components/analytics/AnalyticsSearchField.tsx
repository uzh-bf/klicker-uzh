import { TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface AnalyticsSearchFieldProps {
  type: 'activity' | 'instance'
  value: string
  onChange: (value: string) => void
}

function AnalyticsSearchField({
  type,
  value,
  onChange,
}: AnalyticsSearchFieldProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row items-center gap-3">
      <TextField
        label={
          type === 'activity'
            ? t('manage.analytics.activityNameLabel')
            : t('manage.analytics.elementNameLabel')
        }
        placeholder={t('manage.analytics.searchPlaceholder')}
        value={value}
        onChange={onChange}
        className={{ input: 'h-8 w-60' }}
      />
    </div>
  )
}

export default AnalyticsSearchField
