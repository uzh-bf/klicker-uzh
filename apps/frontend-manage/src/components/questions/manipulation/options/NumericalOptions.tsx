import {
  Button,
  FormLabel,
  FormikNumberField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'

interface NumericalOptionsProps {
  values: ElementFormTypesNumerical
}

function NumericalOptions({ values }: NumericalOptionsProps) {
  const t = useTranslations()

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
        <div className="mt-3">
          <FormLabel
            required
            label={t('manage.questionForms.solutionRanges')}
            labelType="small"
            tooltip={t('manage.questionForms.solutionRangesTooltip')}
          />
          <FieldArray name="options.solutionRanges">
            {({ push, remove }: FieldArrayRenderProps) => (
              <div className="flex w-max flex-col gap-1">
                {values.options.solutionRanges
                  ? values.options.solutionRanges.map(
                      (_range: any, index: number) => (
                        <div
                          className="flex flex-row items-end gap-2"
                          key={`${index}-${values.options.solutionRanges!.length}`}
                        >
                          <FormikNumberField
                            required={index === 0}
                            name={`options.solutionRanges.${index}.min`}
                            label={t('shared.generic.min')}
                            placeholder={t('shared.generic.minLong')}
                            data={{
                              cy: `set-solution-range-min-${index}`,
                            }}
                          />
                          <FormikNumberField
                            required={index === 0}
                            name={`options.solutionRanges.${index}.max`}
                            label={t('shared.generic.max')}
                            placeholder={t('shared.generic.maxLong')}
                            data={{
                              cy: `set-solution-range-max-${index}`,
                            }}
                          />
                          <Button
                            onClick={() => remove(index)}
                            className={{
                              root: 'ml-2 h-9 bg-red-500 text-white hover:bg-red-600',
                            }}
                            data={{
                              cy: `delete-solution-range-ix-${index}`,
                            }}
                          >
                            {t('shared.generic.delete')}
                          </Button>
                        </div>
                      )
                    )
                  : null}
                <Button
                  fluid
                  className={{
                    root: 'border-uzh-grey-100 flex-1 border border-solid font-bold',
                  }}
                  onClick={() =>
                    push({
                      min: undefined,
                      max: undefined,
                    })
                  }
                  data={{ cy: 'add-solution-range' }}
                >
                  {t('manage.questionForms.addSolutionRange')}
                </Button>
              </div>
            )}
          </FieldArray>
        </div>
      )}
    </div>
  )
}

export default NumericalOptions
