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
      className={{
        ...className,
        tooltip: 'z-20',
        select: { trigger: 'h-10 w-max' },
      }}
    />
  )
}

export default MultiplierSelector
