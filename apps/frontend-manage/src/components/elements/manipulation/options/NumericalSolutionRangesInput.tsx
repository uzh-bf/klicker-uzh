import { Button, FormLabel, FormikNumberField } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'

function NumericalSolutionRangesInput({
  disabled,
  solutionRanges,
}: {
  disabled?: boolean
  solutionRanges: ElementFormTypesNumerical['options']['solutionRanges']
}) {
  const t = useTranslations()

  return (
    <div className="mt-3">
      <FormLabel
        required
        label={t('manage.elements.solutionRanges')}
        labelType="small"
        tooltip={t('manage.elements.solutionRangesTooltip')}
      />
      <FieldArray name="options.solutionRanges">
        {({ push, remove }: FieldArrayRenderProps) => (
          <div className="flex w-max flex-col gap-1">
            {solutionRanges
              ? solutionRanges.map((_range: any, index: number) => (
                  <div
                    className="flex flex-row items-end gap-2"
                    // Formik solution arrays contain plain values without a persisted identity; the field index is their controlled identity.
                    // biome-ignore lint/suspicious/noArrayIndexKey: index is the only stable identity available for this controlled Formik array
                    key={`${index}-${solutionRanges!.length}`}
                  >
                    <FormikNumberField
                      required={index === 0}
                      disabled={disabled}
                      name={`options.solutionRanges.${index}.min`}
                      label={t('shared.generic.min')}
                      placeholder={t('shared.generic.minLong')}
                      data={{
                        cy: `set-solution-range-min-${index}`,
                      }}
                    />
                    <FormikNumberField
                      required={index === 0}
                      disabled={disabled}
                      name={`options.solutionRanges.${index}.max`}
                      label={t('shared.generic.max')}
                      placeholder={t('shared.generic.maxLong')}
                      data={{
                        cy: `set-solution-range-max-${index}`,
                      }}
                    />
                    {!disabled ? (
                      <Button
                        destructive
                        onClick={() => remove(index)}
                        className={{ root: 'h-9' }}
                        data={{
                          cy: `delete-solution-range-ix-${index}`,
                        }}
                      >
                        {t('shared.generic.delete')}
                      </Button>
                    ) : null}
                  </div>
                ))
              : null}
            {!disabled ? (
              <Button
                fluid
                className={{
                  root: 'mt-1 h-8 border-gray-300 font-bold',
                }}
                onClick={() =>
                  push({
                    min: undefined,
                    max: undefined,
                  })
                }
                data={{ cy: 'add-solution-range' }}
              >
                {t('manage.elements.addSolutionRange')}
              </Button>
            ) : null}
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default NumericalSolutionRangesInput
