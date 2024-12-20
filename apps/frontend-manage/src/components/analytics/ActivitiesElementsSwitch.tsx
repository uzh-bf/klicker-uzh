import { Button } from '@uzh-bf/design-system'
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
    <div className="flex flex-row">
      <Button
        basic
        onClick={() => setType('activity')}
        className={{
          root: `py-0.25 rounded-l border !border-r-0 border-solid px-2 ${type === 'activity' ? 'bg-primary-100 border-primary-100 text-white' : ''}`,
        }}
      >
        {t('manage.analytics.activities')}
      </Button>
      <Button
        basic
        onClick={() => setType('instance')}
        className={{
          root: `rounded-r border !border-l-0 border-solid px-2 py-0.5 ${type === 'instance' ? 'bg-primary-100 border-primary-100 text-white' : ''}`,
        }}
      >
        {t('manage.analytics.elements')}
      </Button>
    </div>
  )
}

export default ActivitiesElementsSwitch
