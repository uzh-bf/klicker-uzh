import { FormikNumberField, FormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'
import NumericalExactSolutionsInput from './NumericalExactSolutionsInput'
import NumericalSolutionRangesInput from './NumericalSolutionRangesInput'
import NumericalSolutionTypeSwitch from './NumericalSolutionTypeSwitch'

interface NumericalOptionsProps {
  inputsDisabled?: boolean
  values: ElementFormTypesNumerical
}

function NumericalOptions({ inputsDisabled, values }: NumericalOptionsProps) {
  const t = useTranslations()

  return (
    <div>
      <div className="w-full">
        <div className="mb-2 flex flex-row items-center gap-2">
          <FormikNumberField
            disabled={inputsDisabled}
            name="options.restrictions.min"
            label={t('shared.generic.min')}
            placeholder={t('shared.generic.minLong')}
            data={{ cy: 'set-numerical-minimum' }}
            hideError
          />
          <FormikNumberField
            disabled={inputsDisabled}
            name="options.restrictions.max"
            label={t('shared.generic.max')}
            placeholder={t('shared.generic.maxLong')}
            data={{ cy: 'set-numerical-maximum' }}
            hideError
          />
          <FormikTextField
            disabled={inputsDisabled}
            name="options.unit"
            label={t('shared.generic.unit')}
            placeholder="CHF"
            data={{ cy: 'set-numerical-unit' }}
          />
          <FormikNumberField
            disabled={inputsDisabled}
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
          disabled={inputsDisabled}
          solutionType={values.options.solutionType}
        />
      )}
      {values.options.hasSampleSolution &&
        values.options.solutionType === 'range' && (
          <NumericalSolutionRangesInput
            disabled={inputsDisabled}
            solutionRanges={values.options.solutionRanges}
          />
        )}
      {values.options.hasSampleSolution &&
        values.options.solutionType === 'exact' && (
          <NumericalExactSolutionsInput
            disabled={inputsDisabled}
            exactSolutions={values.options.exactSolutions}
            precision={String(values.options.accuracy)}
          />
        )}
    </div>
  )
}

export default NumericalOptions
