import { faPlus } from '@fortawesome/free-solid-svg-icons'
import {
  Button,
  FormikNumberField,
  FormikTextField,
  FormLabel,
  H3,
} from '@uzh-bf/design-system'
import {
  FastField,
  FastFieldProps,
  FieldArray,
  FormikErrors,
  useField,
} from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../../../common/ContentInput'
import { ElementFormTypes, ElementFormTypesCaseStudy } from '../types'
import CaseStudyCaseDeletionButton from './CaseStudyCaseDeletionButton'

export interface CaseStudySetterProps {
  inputsDisabled: boolean
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
  setFieldTouched: (
    field: string,
    isTouched?: boolean,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
}

interface CaseStudyCasesFieldsProps extends CaseStudySetterProps {
  hasSampleSolution: boolean
  selectedItems: { id: number; name: string }[]
}

function CaseStudyCasesFields({
  inputsDisabled,
  setFieldValue,
  setFieldTouched,
  hasSampleSolution,
  selectedItems,
}: CaseStudyCasesFieldsProps) {
  const t = useTranslations()
  const [casesField] =
    useField<ElementFormTypesCaseStudy['options']['cases']>('options.cases')
  const [criteriaField] =
    useField<ElementFormTypesCaseStudy['options']['criteria']>(
      'options.criteria'
    )

  return (
    <div>
      <FieldArray name="options.cases">
        {({ push, remove }) => (
          <div className="flex flex-col gap-4">
            {casesField.value?.map((_, ix) => (
              <div key={ix} className="flex flex-col">
                <div className="-mb-1 flex items-center justify-between">
                  <H3>
                    {t('shared.generic.case')} {ix + 1}
                  </H3>
                  {!inputsDisabled ? (
                    <CaseStudyCaseDeletionButton
                      hasSampleSolution={hasSampleSolution}
                      onConfirm={() => remove(ix)}
                      index={ix}
                    />
                  ) : null}
                </div>
                <FormikTextField
                  required
                  disabled={inputsDisabled}
                  name={`options.cases.${ix}.title`}
                  label={t('manage.elements.caseTitle')}
                  tooltip={t('manage.elements.caseStudyCaseTitleTooltip')}
                  className={{ root: 'mb-1' }}
                  data={{ cy: `case-title-${ix}` }}
                />
                <FastField
                  name={`options.cases.${ix}.description`}
                  shouldUpdate={(next: any, prev: any) =>
                    next?.formik.values.options.cases[ix].description !==
                    prev?.formik.values.options.cases[ix].description
                  }
                >
                  {({ field, meta }: FastFieldProps) => (
                    <div className="w-full">
                      <FormLabel
                        required
                        label={t('manage.elements.caseDescription')}
                        labelType="small"
                        tooltip={t(
                          'manage.elements.caseStudyCaseDescriptionTooltip'
                        )}
                      />
                      <ContentInput
                        error={meta.error}
                        touched={meta.touched}
                        disabled={inputsDisabled}
                        content={field.value}
                        onChange={(newValue: string) => {
                          setFieldValue(
                            `options.cases.${ix}.description`,
                            newValue
                          )
                          setFieldTouched(
                            `options.cases.${ix}.description`,
                            true
                          )
                        }}
                        placeholder={t(
                          'manage.elements.caseDescriptionPlaceholder'
                        )}
                        showToolbarOnFocus={inputsDisabled}
                        className={{ content: 'max-w-none' }}
                        data={{ cy: `case-description-${ix}` }}
                      />
                    </div>
                  )}
                </FastField>

                {hasSampleSolution && selectedItems && criteriaField.value && (
                  <div className="mt-6">
                    <div className="flex flex-row gap-6">
                      <FormLabel
                        required
                        label={t('manage.elements.caseStudySolutions', {
                          number: ix + 1,
                        })}
                        labelType="small"
                        tooltip={t('manage.elements.caseStudySolutionsTooltip')}
                      />
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      {selectedItems.map((item, itemIx) => {
                        const itemIdString = `itemId-${item.id}`

                        return (
                          <div
                            key={item.id}
                            className={twMerge(
                              itemIx !== selectedItems.length - 1
                                ? 'border-b pb-3'
                                : ''
                            )}
                          >
                            <div className="-mb-6 font-bold">{item.name}</div>
                            <div className="flex flex-col gap-2">
                              {criteriaField.value.map(
                                (criterion, criterionIx) => (
                                  <div
                                    key={criterion.id}
                                    className="flex items-end gap-4"
                                  >
                                    <div className="mb-1 line-clamp-1 flex-1">
                                      <span className="mr-2">
                                        {criterion.name}
                                      </span>
                                      <span className="text-sm text-gray-600">
                                        (
                                        {t(
                                          'manage.elements.caseStudySolutionIntervalStep',
                                          {
                                            lower: criterion.min ?? 0,
                                            upper: criterion.max ?? 0,
                                            step: criterion.step,
                                          }
                                        )}
                                        )
                                      </span>
                                    </div>
                                    <div className="flex gap-4">
                                      <FormikNumberField
                                        required
                                        disabled={inputsDisabled}
                                        precision={
                                          criterion.mode === 'steps'
                                            ? 0
                                            : undefined
                                        }
                                        label={
                                          criterionIx === 0
                                            ? t('manage.elements.lowerLimit')
                                            : undefined
                                        }
                                        name={`options.cases.${ix}.solutions.${itemIdString}.${criterion.id}.min`}
                                        className={{
                                          root: 'w-28',
                                          input: 'h-8',
                                        }}
                                        data={{
                                          cy: `case-solution-${ix}-${itemIx}-${criterionIx}-lower`,
                                        }}
                                      />
                                      <FormikNumberField
                                        required
                                        disabled={inputsDisabled}
                                        precision={
                                          criterion.mode === 'steps'
                                            ? 0
                                            : undefined
                                        }
                                        label={
                                          criterionIx === 0
                                            ? t('manage.elements.upperLimit')
                                            : undefined
                                        }
                                        name={`options.cases.${ix}.solutions.${itemIdString}.${criterion.id}.max`}
                                        className={{
                                          root: 'w-28',
                                          input: 'h-8',
                                        }}
                                        data={{
                                          cy: `case-solution-${ix}-${itemIx}-${criterionIx}-upper`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <hr className="border-border mt-4 w-full border-2" />
              </div>
            ))}
            {!inputsDisabled ? (
              <Button
                type="button"
                onClick={() =>
                  push({ id: nanoid(), name: undefined, description: '' })
                }
                className={{
                  root: 'border-primary-80 h-9 font-semibold',
                }}
                data={{ cy: 'add-new-case' }}
              >
                <Button.Icon icon={faPlus} />
                <Button.Label>{t('manage.elements.addCase')}</Button.Label>
              </Button>
            ) : null}
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default CaseStudyCasesFields
