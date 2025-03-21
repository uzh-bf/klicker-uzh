import { FormikSelectField, SelectClassName } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface MultiplierSelectorProps {
  name?: string
  disabled?: boolean
  withoutLabel?: boolean
  className?: SelectClassName
}

function MultiplierSelector({
  disabled = false,
  name = 'multiplier',
  withoutLabel = false,
  className,
}: MultiplierSelectorProps) {
  const t = useTranslations()

  return (
    <FormikSelectField
      required
      disabled={disabled}
      name={name}
      label={!withoutLabel ? t('shared.generic.multiplier') : undefined}
      tooltip={
        !withoutLabel
          ? t('manage.activityWizard.liveQuizMultiplier')
          : undefined
      }
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
        tooltip: 'z-20',
        select: {
          ...className,
          trigger: twMerge('h-9 w-max', className?.trigger),
        },
      }}
    />
  )
}

export default MultiplierSelector
