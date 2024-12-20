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
          basic
          onClick={() => setType('activity')}
          className={{
            root: `py-0.25 h-8 rounded-l border !border-r-0 border-solid px-2 ${type === 'activity' ? 'bg-primary-100 border-primary-100 text-white' : ''}`,
          }}
        >
          {t('manage.analytics.activities')}
        </Button>
        <Button
          basic
          onClick={() => setType('instance')}
          className={{
            root: `h-8 rounded-r border !border-l-0 border-solid px-2 py-0.5 ${type === 'instance' ? 'bg-primary-100 border-primary-100 text-white' : ''}`,
          }}
        >
          {t('manage.analytics.elements')}
        </Button>
      </div>
    </div>
  )
}

export default ActivitiesElementsSwitch
