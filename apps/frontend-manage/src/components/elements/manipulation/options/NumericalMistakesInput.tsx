import {
  Button,
  FormikNumberField,
  FormikTextField,
  FormLabel,
} from '@uzh-bf/design-system'
import { FieldArray } from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import type { NumericalMistakeFormValues } from '../types'

// Typical wrong answers with a formula, a tolerance and the feedback a player
// sees when an answer falls within that tolerance.
function NumericalMistakesInput({
  disabled,
  mistakes,
}: {
  disabled?: boolean
  mistakes?: NumericalMistakeFormValues[]
}) {
  const t = useTranslations()

  return (
    <div className="mt-3">
      <FormLabel
        required={false}
        label={t('manage.elements.typicalMistakes')}
        labelType="small"
        tooltip={t('manage.elements.typicalMistakesTooltip')}
      />
      <FieldArray name="options.mistakes">
        {({ push, remove }) => (
          <div className="flex flex-col gap-2">
            {(mistakes ?? []).map((mistake, index) => {
              const path = `options.mistakes.${index}`
              return (
                <div
                  key={mistake.key}
                  className="flex flex-row flex-wrap items-end gap-2 rounded border p-2"
                  data-cy={`numerical-mistake-${index}`}
                >
                  <FormikTextField
                    required
                    disabled={disabled}
                    name={`${path}.label`}
                    label={t('manage.elements.mistakeLabel')}
                    className={{ root: 'w-44' }}
                    data={{ cy: `numerical-mistake-label-${index}` }}
                  />
                  <FormikTextField
                    required
                    disabled={disabled}
                    name={`${path}.formula`}
                    label={t('manage.elements.formula')}
                    className={{ root: 'w-44' }}
                    data={{ cy: `numerical-mistake-formula-${index}` }}
                  />
                  <FormikNumberField
                    required
                    disabled={disabled}
                    name={`${path}.tolerance`}
                    label={t('manage.elements.tolerance')}
                    className={{ root: 'w-24' }}
                    data={{ cy: `numerical-mistake-tolerance-${index}` }}
                  />
                  <FormikTextField
                    disabled={disabled}
                    name={`${path}.feedback`}
                    label={t('manage.elements.mistakeFeedback')}
                    className={{ root: 'w-full', input: 'w-full' }}
                    data={{ cy: `numerical-mistake-feedback-${index}` }}
                  />
                  {!disabled && (
                    <Button
                      destructive
                      onClick={() => remove(index)}
                      className={{ root: 'h-9' }}
                      data={{ cy: `delete-numerical-mistake-${index}` }}
                    >
                      {t('shared.generic.delete')}
                    </Button>
                  )}
                </div>
              )
            })}
            {!disabled && (
              <Button
                className={{ root: 'h-8 w-max font-bold' }}
                onClick={() =>
                  push({
                    key: nanoid(8),
                    label: '',
                    feedback: '',
                    formula: '',
                    tolerance: 0,
                  } satisfies NumericalMistakeFormValues)
                }
                data={{ cy: 'add-numerical-mistake' }}
              >
                {t('manage.elements.addMistake')}
              </Button>
            )}
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default NumericalMistakesInput
