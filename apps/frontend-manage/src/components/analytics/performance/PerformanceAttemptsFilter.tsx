import { Label, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function PerformanceAttemptsFilter({
  attemptsType,
  setAttemptsType,
}: {
  attemptsType: 'first' | 'last' | 'total'
  setAttemptsType: Dispatch<SetStateAction<'first' | 'last' | 'total'>>
}) {
  const t = useTranslations()

  return (
    <div className="flex flex-row items-center gap-3">
      <Label
        label={t('manage.analytics.answers')}
        className={{ root: 'font-bold' }}
      />
      <Select
        items={[
          { value: 'total', label: t('manage.analytics.allAttempts') },
          { value: 'first', label: t('manage.analytics.firstAttempts') },
          { value: 'last', label: t('manage.analytics.lastAttempts') },
        ]}
        value={attemptsType}
        onChange={(value) =>
          setAttemptsType(value as 'first' | 'last' | 'total')
        }
        className={{ root: 'w-40', trigger: 'h-8' }}
      />
    </div>
  )
}

export default PerformanceAttemptsFilter
