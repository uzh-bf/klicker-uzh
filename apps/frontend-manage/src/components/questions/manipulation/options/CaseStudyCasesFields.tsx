import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../../../common/ContentInput'
import { ElementFormTypes, ElementFormTypesCaseStudy } from '../types'
import CaseStudyCaseDeletionButton from './CaseStudyCaseDeletionButton'

export interface CaseStudySetterProps {
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
                  <CaseStudyCaseDeletionButton
                    hasSampleSolution={hasSampleSolution}
                    onConfirm={() => remove(ix)}
                    index={ix}
                  />
                </div>
                <FormikTextField
                  required
                  name={`options.cases.${ix}.title`}
                  label={t('manage.questionForms.caseTitle')}
                  tooltip={t('manage.questionForms.caseStudyCaseTitleTooltip')}
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
                        label={t('manage.questionForms.caseDescription')}
                        labelType="small"
                        tooltip={t(
                          'manage.questionForms.caseStudyCaseDescriptionTooltip'
                        )}
                      />
                      <ContentInput
                        error={meta.error}
                        touched={meta.touched}
                        content={field.value || '<br>'}
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
                          'manage.questionForms.caseDescriptionPlaceholder'
                        )}
                        showToolbarOnFocus={false}
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
                        label={t('manage.questionForms.caseStudySolutions', {
                          number: ix + 1,
                        })}
                        labelType="small"
                        tooltip={t(
                          'manage.questionForms.caseStudySolutionsTooltip'
                        )}
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
                                      {criterion.name}
                                    </div>
                                    <div className="flex gap-4">
                                      <FormikNumberField
                                        required
                                        label={
                                          criterionIx === 0
                                            ? t(
                                                'manage.questionForms.lowerLimit'
                                              )
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
                                        label={
                                          criterionIx === 0
                                            ? t(
                                                'manage.questionForms.upperLimit'
                                              )
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

                <hr className="border-uzh-grey-40 mt-4 w-full border-2" />
              </div>
            ))}
            <Button
              type="button"
              onClick={() => push({ name: undefined, description: '' })}
              className={{
                root: 'border-primary-80 justify-center font-semibold',
              }}
              data={{ cy: 'add-new-case' }}
            >
              <FontAwesomeIcon icon={faPlus} />
              {t('manage.questionForms.addCase')}
            </Button>
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default CaseStudyCasesFields
