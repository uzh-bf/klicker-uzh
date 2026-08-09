import { Button, FormikNumberField, FormLabel } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'

function NumericalExactSolutionsInput({
  disabled,
  exactSolutions,
  precision,
}: {
  disabled?: boolean
  exactSolutions: ElementFormTypesNumerical['options']['exactSolutions']
  precision?: string | null
}) {
  const t = useTranslations()

  return (
    <div className="mt-3">
      <FormLabel
        required
        label={t('manage.elements.exactSolutions')}
        labelType="small"
        tooltip={t('manage.elements.exactSolutionsTooltip')}
      />
      <FieldArray name="options.exactSolutions">
        {({ push, remove }: FieldArrayRenderProps) => (
          <div className="flex w-max flex-col gap-1">
            {exactSolutions?.map((_, index: number) => (
              <div
                className="flex flex-row items-end gap-2"
                // Formik solution arrays contain plain values without a persisted identity; the field index is their controlled identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: index is the only stable identity available for this controlled Formik array
                key={`exact-solution-${index}`}
              >
                <FormikNumberField
                  hideError
                  required={index === 0}
                  disabled={disabled}
                  name={`options.exactSolutions.${index}`}
                  label={t('shared.generic.value')}
                  placeholder={`${t('shared.generic.value')} ${index + 1}`}
                  precision={precision ? parseInt(precision) : undefined}
                  data={{
                    cy: `set-exact-solution-${index}`,
                  }}
                />
                {!disabled ? (
                  <Button
                    destructive
                    onClick={() => remove(index)}
                    className={{
                      root: 'h-9',
                    }}
                    data={{
                      cy: `delete-exact-solution-${index}`,
                    }}
                  >
                    {t('shared.generic.delete')}
                  </Button>
                ) : null}
              </div>
            ))}
            {!disabled ? (
              <Button
                fluid
                className={{
                  root: 'mt-1 h-8 border-gray-300 font-bold',
                }}
                onClick={() => push(undefined)}
                data={{ cy: 'add-exact-solution' }}
              >
                {t('manage.elements.addExactSolution')}
              </Button>
            ) : null}
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default NumericalExactSolutionsInput
