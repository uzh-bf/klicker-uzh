import { Button, FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { SetStateAction } from 'react'

function ActivitiesElementsSwitch({
  type,
  setType,
}: {
  type: 'activity' | 'instance'
  setType: (value: SetStateAction<'activity' | 'instance'>) => void
}) {
  const t = useTranslations()

  return (
    <div>
      <FormLabel
        label={t('manage.analytics.dataSource')}
        labelType="small"
        required={false}
      />
      <div className="flex flex-row">
        <Button
          primary={type === 'activity'}
          onClick={() => setType('activity')}
          className={{
            root: 'rounded-r-none! border-r-0! h-8 px-2 py-0',
          }}
        >
          <Button.Label>{t('manage.analytics.activities')}</Button.Label>
        </Button>
        <Button
          primary={type === 'instance'}
          onClick={() => setType('instance')}
          className={{
            root: 'rounded-l-none! border-l-0! h-8 px-2 py-0',
          }}
        >
          <Button.Label>{t('manage.analytics.elements')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default ActivitiesElementsSwitch
