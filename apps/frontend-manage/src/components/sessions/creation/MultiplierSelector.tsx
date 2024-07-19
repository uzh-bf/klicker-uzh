import { NewFormikSelectField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface MultiplierSelectorProps {
  disabled: boolean
}

function MultiplierSelector({ disabled }: MultiplierSelectorProps) {
  const t = useTranslations()

  return (
    <NewFormikSelectField
      disabled={disabled}
      name="multiplier"
      label={t('shared.generic.multiplier')}
      tooltip={t('manage.sessionForms.liveQuizMultiplier')}
      placeholder={t('manage.sessionForms.multiplierDefault')}
      items={[
        {
          label: t('manage.sessionForms.multiplier1'),
          value: '1',
          data: {
            cy: `select-multiplier-${t('manage.sessionForms.multiplier1')}`,
          },
        },
        {
          label: t('manage.sessionForms.multiplier2'),
          value: '2',
          data: {
            cy: `select-multiplier-${t('manage.sessionForms.multiplier2')}`,
          },
        },
        {
          label: t('manage.sessionForms.multiplier3'),
          value: '3',
          data: {
            cy: `select-multiplier-${t('manage.sessionForms.multiplier3')}`,
          },
        },
        {
          label: t('manage.sessionForms.multiplier4'),
          value: '4',
          data: {
            cy: `select-multiplier-${t('manage.sessionForms.multiplier4')}`,
          },
        },
      ]}
      data={{ cy: 'select-multiplier' }}
      className={{ tooltip: 'z-20', label: 'text-base mb-0.5' }}
    />
  )
}

export default MultiplierSelector
