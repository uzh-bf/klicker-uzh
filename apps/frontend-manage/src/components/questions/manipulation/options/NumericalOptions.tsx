import { FormikNumberField, FormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'
import NumericalSolutionRangesInput from './NumericalSolutionRangesInput'
import NumericalSolutionTypeSwitch from './NumericalSolutionTypeSwitch'

interface NumericalOptionsProps {
  values: ElementFormTypesNumerical
}

function NumericalOptions({ values }: NumericalOptionsProps) {
  const t = useTranslations()

  // TODO: add UI for entering exact numerical solutions

  return (
    <div>
      <div className="w-full">
        <div className="mb-2 flex flex-row items-center gap-2">
          <FormikNumberField
            name="options.restrictions.min"
            label={t('shared.generic.min')}
            placeholder={t('shared.generic.minLong')}
            data={{ cy: 'set-numerical-minimum' }}
            hideError
          />
          <FormikNumberField
            name="options.restrictions.max"
            label={t('shared.generic.max')}
            placeholder={t('shared.generic.maxLong')}
            data={{ cy: 'set-numerical-maximum' }}
            hideError
          />
          <FormikTextField
            name="options.unit"
            label={t('shared.generic.unit')}
            placeholder="CHF"
            data={{ cy: 'set-numerical-unit' }}
          />
          <FormikNumberField
            name="options.accuracy"
            label={t('shared.generic.precision')}
            precision={0}
            data={{ cy: 'set-numerical-accuracy' }}
            hideError
          />
        </div>
      </div>
      {values.options.hasSampleSolution && (
        <NumericalSolutionTypeSwitch
          solutionType={values.options.solutionType}
        />
      )}
      {values.options.hasSampleSolution &&
        values.options.solutionType === 'range' && (
          <NumericalSolutionRangesInput
            solutionRanges={values.options.solutionRanges}
          />
        )}
    </div>
  )
}

export default NumericalOptions
