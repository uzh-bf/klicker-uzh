import { useLazyQuery } from '@apollo/client'
import { PreviewNumericalElementDocument } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
  FormLabel,
} from '@uzh-bf/design-system'
import { FieldArray, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { prepareNumericalTemplateOptions } from '../helpers'
import type {
  ElementFormTypesNumerical,
  NumericalParametrizationFormValues,
} from '../types'

const DEFAULT_PARAMETRIZATION: NumericalParametrizationFormValues = {
  variables: [{ name: 'A', kind: 'INTEGER', min: 1, max: 10, step: 1 }],
  derived: [],
  solution: { formula: 'A', tolerance: 0 },
  numberFormat: 'APOSTROPHE',
}

const VARIABLE_KINDS = ['INTEGER', 'RANGE', 'PICK'] as const

// Variables, derived values and the solution formula of a numerical element
// whose numbers are drawn per attempt.
export function NumericalParametrizationInput({
  disabled,
  parametrization,
}: {
  disabled?: boolean
  parametrization?: NumericalParametrizationFormValues
}) {
  const t = useTranslations()
  const { setFieldValue } = useFormikContext<ElementFormTypesNumerical>()

  useEffect(() => {
    if (!parametrization) {
      setFieldValue('options.parametrization', DEFAULT_PARAMETRIZATION)
    }
  }, [parametrization, setFieldValue])

  if (!parametrization) return null

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <FormLabel
          required
          label={t('manage.elements.numericalVariables')}
          labelType="small"
          tooltip={t('manage.elements.numericalVariablesTooltip')}
        />
        <FieldArray name="options.parametrization.variables">
          {({ push, remove }) => (
            <div className="flex flex-col gap-1">
              {parametrization.variables.map((variable, index) => {
                const path = `options.parametrization.variables.${index}`
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: form rows are positional
                    key={index}
                    className="flex flex-row flex-wrap items-end gap-2"
                    data-cy={`numerical-variable-${index}`}
                  >
                    <FormikTextField
                      disabled={disabled}
                      name={`${path}.name`}
                      label={t('manage.elements.variableName')}
                      className={{ root: 'w-24' }}
                      data={{ cy: `numerical-variable-name-${index}` }}
                    />
                    <FormikSelectField
                      disabled={disabled}
                      contentPosition="popper"
                      name={`${path}.kind`}
                      label={t('manage.elements.variableKind')}
                      items={VARIABLE_KINDS.map((kind) => ({
                        value: kind,
                        label: t(`manage.elements.variableKind${kind}`),
                      }))}
                      className={{ select: { trigger: 'h-9 w-36' } }}
                      data={{ cy: `numerical-variable-kind-${index}` }}
                    />
                    {variable.kind === 'PICK' ? (
                      <FormikTextField
                        disabled={disabled}
                        name={`${path}.values`}
                        label={t('manage.elements.variableValues')}
                        data={{ cy: `numerical-variable-values-${index}` }}
                      />
                    ) : (
                      <>
                        <FormikNumberField
                          disabled={disabled}
                          name={`${path}.min`}
                          label={t('shared.generic.min')}
                          className={{ root: 'w-24' }}
                          data={{ cy: `numerical-variable-min-${index}` }}
                        />
                        <FormikNumberField
                          disabled={disabled}
                          name={`${path}.max`}
                          label={t('shared.generic.max')}
                          className={{ root: 'w-24' }}
                          data={{ cy: `numerical-variable-max-${index}` }}
                        />
                        <FormikNumberField
                          disabled={disabled}
                          name={`${path}.step`}
                          label={t('manage.elements.variableStep')}
                          className={{ root: 'w-20' }}
                          data={{ cy: `numerical-variable-step-${index}` }}
                        />
                      </>
                    )}
                    <FormikNumberField
                      disabled={disabled}
                      name={`${path}.decimals`}
                      label={t('manage.elements.variableDecimals')}
                      precision={0}
                      className={{ root: 'w-20' }}
                      data={{ cy: `numerical-variable-decimals-${index}` }}
                    />
                    {!disabled && (
                      <Button
                        destructive
                        onClick={() => remove(index)}
                        className={{ root: 'h-9' }}
                        data={{ cy: `delete-numerical-variable-${index}` }}
                      >
                        {t('shared.generic.delete')}
                      </Button>
                    )}
                  </div>
                )
              })}
              {!disabled && (
                <Button
                  className={{ root: 'mt-1 h-8 w-max font-bold' }}
                  onClick={() =>
                    push({ name: '', kind: 'INTEGER', min: 1, max: 10 })
                  }
                  data={{ cy: 'add-numerical-variable' }}
                >
                  {t('manage.elements.addVariable')}
                </Button>
              )}
            </div>
          )}
        </FieldArray>
      </div>

      <div>
        <FormLabel
          required={false}
          label={t('manage.elements.derivedValues')}
          labelType="small"
          tooltip={t('manage.elements.derivedValuesTooltip')}
        />
        <FieldArray name="options.parametrization.derived">
          {({ push, remove }) => (
            <div className="flex flex-col gap-1">
              {parametrization.derived.map((_, index) => {
                const path = `options.parametrization.derived.${index}`
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: form rows are positional
                    key={index}
                    className="flex flex-row flex-wrap items-end gap-2"
                  >
                    <FormikTextField
                      disabled={disabled}
                      name={`${path}.name`}
                      label={t('manage.elements.variableName')}
                      className={{ root: 'w-24' }}
                      data={{ cy: `numerical-derived-name-${index}` }}
                    />
                    <FormikTextField
                      disabled={disabled}
                      name={`${path}.formula`}
                      label={t('manage.elements.formula')}
                      className={{ root: 'w-56' }}
                      data={{ cy: `numerical-derived-formula-${index}` }}
                    />
                    <FormikNumberField
                      disabled={disabled}
                      name={`${path}.decimals`}
                      label={t('manage.elements.variableDecimals')}
                      precision={0}
                      className={{ root: 'w-20' }}
                      data={{ cy: `numerical-derived-decimals-${index}` }}
                    />
                    {!disabled && (
                      <Button
                        destructive
                        onClick={() => remove(index)}
                        className={{ root: 'h-9' }}
                        data={{ cy: `delete-numerical-derived-${index}` }}
                      >
                        {t('shared.generic.delete')}
                      </Button>
                    )}
                  </div>
                )
              })}
              {!disabled && (
                <Button
                  className={{ root: 'mt-1 h-8 w-max font-bold' }}
                  onClick={() => push({ name: '', formula: '' })}
                  data={{ cy: 'add-numerical-derived' }}
                >
                  {t('manage.elements.addDerivedValue')}
                </Button>
              )}
            </div>
          )}
        </FieldArray>
      </div>

      <div className="flex flex-row flex-wrap items-end gap-2">
        <FormikTextField
          required
          disabled={disabled}
          name="options.parametrization.solution.formula"
          label={t('manage.elements.solutionFormulaLabel')}
          tooltip={t('manage.elements.solutionFormulaTooltip')}
          className={{ root: 'w-56' }}
          data={{ cy: 'numerical-solution-formula' }}
        />
        <FormikNumberField
          required
          disabled={disabled}
          name="options.parametrization.solution.tolerance"
          label={t('manage.elements.tolerance')}
          className={{ root: 'w-24' }}
          data={{ cy: 'numerical-solution-tolerance' }}
        />
        <FormikSelectField
          disabled={disabled}
          contentPosition="popper"
          name="options.parametrization.numberFormat"
          label={t('manage.elements.numberFormat')}
          items={(['APOSTROPHE', 'COMMA'] as const).map((format) => ({
            value: format,
            label: t(`manage.elements.numberFormat${format}`),
          }))}
          className={{ select: { trigger: 'h-9 w-48' } }}
          data={{ cy: 'numerical-number-format' }}
        />
      </div>
    </div>
  )
}

// Asks the server to validate the draft and render three sample draws, so
// the lecturer sees the numbers, the correct range and the mistake ranges.
export function NumericalTemplatePreview() {
  const t = useTranslations()
  const { values } = useFormikContext<ElementFormTypesNumerical>()
  const [preview, { data, loading }] = useLazyQuery(
    PreviewNumericalElementDocument,
    { fetchPolicy: 'no-cache' }
  )
  const result = data?.previewNumericalElement

  return (
    <div className="mt-3" data-cy="numerical-template-preview">
      <Button
        disabled={loading}
        className={{ root: 'h-8 font-bold' }}
        onClick={() => {
          const { parametrization, mistakes } = prepareNumericalTemplateOptions(
            values.options
          )
          preview({
            variables: {
              content: values.content,
              explanation: values.explanation,
              options: {
                hasSampleSolution: values.options.hasSampleSolution,
                parametrization,
                mistakes,
                solutionRanges:
                  values.options.solutionType === 'range'
                    ? values.options.solutionRanges?.map((range) => ({
                        min: range.min === '' ? null : Number(range.min),
                        max: range.max === '' ? null : Number(range.max),
                      }))
                    : undefined,
                exactSolutions:
                  values.options.solutionType === 'exact'
                    ? values.options.exactSolutions?.map(Number)
                    : undefined,
              },
            },
          })
        }}
        data={{ cy: 'preview-numerical-draws' }}
      >
        {t('manage.elements.previewDraws')}
      </Button>
      {result && result.errors.length > 0 && (
        <div
          className="mt-2 text-sm text-red-700"
          data-cy="numerical-preview-errors"
        >
          <div className="font-bold">{t('manage.elements.previewErrors')}</div>
          <ul className="list-inside list-disc">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {result && result.samples.length > 0 && (
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {result.samples.map((sample, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: draws have no identity of their own
              key={index}
              className="rounded border p-2 text-sm"
              data-cy={`numerical-preview-sample-${index}`}
            >
              <div className="font-bold">
                {t('manage.elements.previewDrawN', { number: index + 1 })}
              </div>
              <div className="whitespace-pre-wrap">{sample.content}</div>
              {sample.solutionMin != null && sample.solutionMax != null && (
                <div className="mt-1 text-green-800">
                  {t('manage.elements.previewSolution', {
                    min: sample.solutionMin,
                    max: sample.solutionMax,
                  })}
                </div>
              )}
              {sample.mistakes.map((mistake) => (
                <div key={mistake.key} className="text-orange-800">
                  {t('manage.elements.previewMistake', {
                    label: mistake.label,
                    min: mistake.min,
                    max: mistake.max,
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
