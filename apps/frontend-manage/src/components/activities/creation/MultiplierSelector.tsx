import { FormikSelectField, SelectClassName } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface MultiplierSelectorProps {
  name?: string
  disabled?: boolean
  className?: SelectClassName
}

function MultiplierSelector({
  disabled = false,
  name = 'multiplier',
  className,
}: MultiplierSelectorProps) {
  const t = useTranslations()

  return (
    <FormikSelectField
      required
      disabled={disabled}
      name={name}
      label={t('shared.generic.multiplier')}
      tooltip={t('manage.activityWizard.liveQuizMultiplier')}
      placeholder={t('manage.activityWizard.multiplierDefault')}
      items={[
        {
          label: t('manage.activityWizard.multiplier1'),
          value: '1',
          data: {
            cy: `select-multiplier-${t('manage.activityWizard.multiplier1')}`,
          },
        },
        {
          label: t('manage.activityWizard.multiplier2'),
          value: '2',
          data: {
            cy: `select-multiplier-${t('manage.activityWizard.multiplier2')}`,
          },
        },
        {
          label: t('manage.activityWizard.multiplier3'),
          value: '3',
          data: {
            cy: `select-multiplier-${t('manage.activityWizard.multiplier3')}`,
          },
        },
        {
          label: t('manage.activityWizard.multiplier4'),
          value: '4',
          data: {
            cy: `select-multiplier-${t('manage.activityWizard.multiplier4')}`,
          },
        },
      ]}
      data={{ cy: 'select-multiplier' }}
      className={{
        ...className,
        tooltip: 'z-20',
        select: { trigger: 'h-10 w-max' },
      }}
    />
  )
}

export default MultiplierSelector
