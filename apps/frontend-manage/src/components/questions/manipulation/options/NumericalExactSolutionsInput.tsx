import { Button, FormikNumberField, FormLabel } from '@uzh-bf/design-system'
import { FieldArray, FieldArrayRenderProps } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'

function NumericalExactSolutionsInput({
  exactSolutions,
  precision,
}: {
  exactSolutions: ElementFormTypesNumerical['options']['exactSolutions']
  precision?: string | null
}) {
  const t = useTranslations()

  return (
    <div className="mt-3">
      <FormLabel
        required
        label={t('manage.questionForms.exactSolutions')}
        labelType="small"
        tooltip={t('manage.questionForms.exactSolutionsTooltip')}
      />
      <FieldArray name="options.exactSolutions">
        {({ push, remove }: FieldArrayRenderProps) => (
          <div className="flex w-max flex-col gap-1">
            {exactSolutions?.map((_, index: number) => (
              <div
                className="flex flex-row items-end gap-2"
                key={`exact-solution-${index}`}
              >
                <FormikNumberField
                  hideError
                  required={index === 0}
                  name={`options.exactSolutions.${index}`}
                  label={t('shared.generic.value')}
                  placeholder={`${t('shared.generic.value')} ${index + 1}`}
                  precision={precision ? parseInt(precision) : undefined}
                  data={{
                    cy: `set-exact-solution-${index}`,
                  }}
                />
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
              </div>
            ))}
            <Button
              fluid
              className={{
                root: 'mt-1 h-8 border-gray-300 font-bold',
              }}
              onClick={() => push(undefined)}
              data={{ cy: 'add-exact-solution' }}
            >
              {t('manage.questionForms.addExactSolution')}
            </Button>
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default NumericalExactSolutionsInput
