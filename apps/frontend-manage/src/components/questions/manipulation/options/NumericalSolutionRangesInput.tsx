import { Button, FormLabel, FormikNumberField } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'

function NumericalSolutionRangesInput({
  solutionRanges,
}: {
  solutionRanges: ElementFormTypesNumerical['options']['solutionRanges']
}) {
  const t = useTranslations()

  return (
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
            {solutionRanges
              ? solutionRanges.map((_range: any, index: number) => (
                  <div
                    className="flex flex-row items-end gap-2"
                    key={`${index}-${solutionRanges!.length}`}
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
                ))
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
  )
}

export default NumericalSolutionRangesInput
