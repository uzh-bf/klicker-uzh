import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, type FieldArrayRenderProps } from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ElementFormTypesFreeText } from '../types'

function FreeTextOutcomeBandEditor({
  values,
  disabled,
}: {
  values: ElementFormTypesFreeText
  disabled: boolean
}) {
  const t = useTranslations()
  const bands = values.options.semanticEvaluation?.outcome_bands ?? []
  const [bandKeys, setBandKeys] = useState(() => bands.map(() => nanoid()))

  return (
    <section className="flex flex-col gap-3" data-cy="semantic-outcome-bands">
      <div>
        <h4 className="font-semibold">
          {t('manage.elements.semanticOutcomeBands')}
        </h4>
        <p className="text-sm text-gray-600">
          {t('manage.elements.semanticOutcomeBandsDescription')}
        </p>
      </div>
      <FieldArray name="options.semanticEvaluation.outcome_bands">
        {({ push, remove }: FieldArrayRenderProps) => (
          <div className="flex flex-col gap-2">
            {bands.map((_band, index) => (
              <div
                key={bandKeys[index]!}
                className="grid gap-2 rounded-md border border-gray-300 p-2 md:grid-cols-[1fr_1fr_7rem_7rem_10rem_auto] md:items-end"
                data-cy={`semantic-outcome-band-${index}`}
              >
                <FormikTextField
                  required
                  disabled={disabled}
                  name={`options.semanticEvaluation.outcome_bands.${index}.id`}
                  label={t('manage.elements.semanticOutcomeId')}
                  data={{ cy: `semantic-outcome-id-${index}` }}
                />
                <FormikTextField
                  required
                  disabled={disabled}
                  name={`options.semanticEvaluation.outcome_bands.${index}.label`}
                  label={t('manage.elements.semanticOutcomeLabel')}
                  data={{ cy: `semantic-outcome-label-${index}` }}
                />
                <FormikNumberField
                  required
                  disabled={disabled}
                  name={`options.semanticEvaluation.outcome_bands.${index}.min_score`}
                  label={t('manage.elements.semanticMinimumScore')}
                  min={0}
                  max={100}
                  precision={0}
                  data={{ cy: `semantic-outcome-min-${index}` }}
                />
                <FormikNumberField
                  required
                  disabled={disabled}
                  name={`options.semanticEvaluation.outcome_bands.${index}.max_score`}
                  label={t('manage.elements.semanticMaximumScore')}
                  min={0}
                  max={100}
                  precision={0}
                  data={{ cy: `semantic-outcome-max-${index}` }}
                />
                <FormikSelectField
                  required
                  disabled={disabled}
                  name={`options.semanticEvaluation.outcome_bands.${index}.category`}
                  label={t('manage.elements.semanticCategory')}
                  items={[
                    {
                      value: 'INCORRECT',
                      label: t('manage.elements.semanticIncorrect'),
                    },
                    {
                      value: 'PARTIAL',
                      label: t('manage.elements.semanticPartial'),
                    },
                    {
                      value: 'CORRECT',
                      label: t('manage.elements.semanticCorrect'),
                    },
                  ]}
                  data={{ cy: `semantic-outcome-category-${index}` }}
                />
                {!disabled && (
                  <Button
                    destructive
                    disabled={bands.length <= 1}
                    onClick={() => {
                      setBandKeys((keys) =>
                        keys.filter((_key, keyIndex) => keyIndex !== index)
                      )
                      remove(index)
                    }}
                    data={{ cy: `semantic-delete-outcome-${index}` }}
                  >
                    {t('shared.generic.delete')}
                  </Button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button
                onClick={() => {
                  setBandKeys((keys) => [...keys, nanoid()])
                  push({
                    id: `outcome-${nanoid()}`,
                    label: '',
                    min_score: 0,
                    max_score: 100,
                    category: 'PARTIAL',
                  })
                }}
                data={{ cy: 'semantic-add-outcome-band' }}
              >
                {t('manage.elements.semanticAddOutcomeBand')}
              </Button>
            )}
          </div>
        )}
      </FieldArray>
    </section>
  )
}

export default FreeTextOutcomeBandEditor
