import { Button, FormLabel } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { ElementFormTypesNumerical } from '../types'

function NumericalSolutionTypeSwitch({
  disabled,
  solutionType,
}: {
  disabled?: boolean
  solutionType: ElementFormTypesNumerical['options']['solutionType']
}) {
  const t = useTranslations()
  const [_, __, helpers] = useField('options.solutionType')

  return (
    <div className="mt-3">
      <FormLabel
        required
        label={t('manage.elements.solutionTypeNumerical')}
        labelType="small"
        tooltip={t('manage.elements.solutionTypeNumericalTooltip')}
      />
      <div className="flex flex-row">
        <Button
          disabled={disabled}
          onClick={() => helpers.setValue('range')}
          className={{
            root: twMerge(
              'h-8 rounded-r-none',
              solutionType === 'range'
                ? 'bg-primary-100 border-primary-100 hover:bg-primary-100 text-white hover:text-white'
                : ''
            ),
          }}
          data={{ cy: 'set-solution-type-range' }}
        >
          <Button.Label>{t('manage.elements.solutionRanges')}</Button.Label>
        </Button>
        <Button
          disabled={disabled}
          onClick={() => helpers.setValue('exact')}
          className={{
            root: twMerge(
              'h-8 !rounded-l-none',
              solutionType === 'exact'
                ? 'bg-primary-100 border-primary-100 hover:bg-primary-100 text-white hover:text-white'
                : ''
            ),
          }}
          data={{ cy: 'set-solution-type-exact' }}
        >
          <Button.Label>{t('manage.elements.exactSolutions')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default NumericalSolutionTypeSwitch
