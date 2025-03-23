import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  FormikNumberField,
  FormikTextField,
  H3,
} from '@uzh-bf/design-system'
import { FieldArray, useField } from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import {
  ElementFormTypesCaseStudy,
  ElementFormTypesCaseStudyCriterion,
} from '../types'

function CaseStudyCriteriaFields() {
  const t = useTranslations()
  const [field, _, __] =
    useField<ElementFormTypesCaseStudyCriterion[]>('options.criteria')
  const [casesField, ___, casesHelpers] =
    useField<ElementFormTypesCaseStudy['options']['cases']>('options.cases')

  return (
    <div>
      <H3>{t('shared.generic.criteria')}</H3>
      <div>{t('manage.questionForms.caseStudyCriteriaDescription')}</div>
      <div className="mt-1.5 flex flex-col gap-2">
        <FieldArray name="options.criteria">
          {({ push, remove }) => (
            <>
              {field.value?.map((_, index) => (
                <div
                  key={index}
                  className={twMerge(
                    'flex flex-row items-end gap-2',
                    index !== 0 && 'h-9'
                  )}
                >
                  <FormikTextField
                    required
                    hideError
                    name={`options.criteria.${index}.name`}
                    label={index === 0 ? t('shared.generic.name') : undefined}
                    tooltip={t(
                      'manage.questionForms.caseStudyCriteriaNameTooltip'
                    )}
                    className={{
                      root: 'flex-1',
                      input: 'h-8',
                      tooltip: 'max-w-[30rem]',
                    }}
                    maxLength={100}
                    data={{ cy: `criterion-${index}-name` }}
                  />
                  <FormikNumberField
                    required
                    hideError
                    name={`options.criteria.${index}.min`}
                    label={
                      index === 0 ? t('shared.generic.minimumShort') : undefined
                    }
                    tooltip={t(
                      'manage.questionForms.caseStudyCriteriaMinTooltip'
                    )}
                    className={{
                      root: 'w-28',
                      input: 'h-8',
                      tooltip: 'max-w-[30rem]',
                    }}
                    data={{ cy: `criterion-${index}-min` }}
                  />
                  <FormikNumberField
                    required
                    hideError
                    name={`options.criteria.${index}.max`}
                    label={
                      index === 0 ? t('shared.generic.maximumShort') : undefined
                    }
                    tooltip={t(
                      'manage.questionForms.caseStudyCriteriaMaxTooltip'
                    )}
                    className={{
                      root: 'w-28',
                      input: 'h-8',
                      tooltip: 'max-w-[30rem]',
                    }}
                    data={{ cy: `criterion-${index}-max` }}
                  />
                  <FormikNumberField
                    required
                    hideError
                    name={`options.criteria.${index}.step`}
                    label={index === 0 ? t('shared.generic.step') : undefined}
                    tooltip={t(
                      'manage.questionForms.caseStudyCriteriaStepTooltip'
                    )}
                    className={{
                      root: 'w-28',
                      input: 'h-8',
                      tooltip: 'max-w-[30rem]',
                    }}
                    data={{ cy: `criterion-${index}-step` }}
                  />
                  <FormikTextField
                    hideError
                    name={`options.criteria.${index}.unit`}
                    label={index === 0 ? t('shared.generic.unit') : undefined}
                    tooltip={t(
                      'manage.questionForms.caseStudyCriteriaUnitTooltip'
                    )}
                    className={{
                      root: 'w-28 self-end',
                      input: 'h-8',
                      tooltip: 'max-w-[30rem]',
                    }}
                    maxLength={10}
                    data={{ cy: `criterion-${index}-unit` }}
                  />
                  <Button
                    onClick={() => {
                      // get the nanoid for the criterion that should be removed
                      const removedCriterionId = field.value?.[index]?.id

                      // remove criterion
                      remove(index)

                      // remove all solutions for this criterion
                      const newCases = casesField.value?.map((caseItem) => {
                        // if no solutions are set, skip this case
                        if (!('solutions' in caseItem) || !caseItem.solutions) {
                          return caseItem
                        }

                        // filter out the solutions for the removed criterion
                        const newSolutions = Object.fromEntries(
                          Object.entries(caseItem.solutions).map(
                            ([itemIdString, itemSolutions]) => {
                              const newItemSolutions = Object.fromEntries(
                                Object.entries(itemSolutions).filter(
                                  ([criterionId, _]) =>
                                    criterionId !== removedCriterionId
                                )
                              )

                              return [itemIdString, newItemSolutions]
                            }
                          )
                        )

                        return {
                          ...caseItem,
                          solutions: newSolutions,
                        }
                      })

                      // update the cases field
                      casesHelpers.setValue(newCases)
                    }}
                    className={{
                      root: 'h-8 w-8 border-red-600 hover:border-red-600 hover:text-red-600',
                    }}
                    data={{ cy: `remove-criterion-${index}` }}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  push({
                    id: nanoid(),
                    name: undefined,
                    min: undefined,
                    max: undefined,
                    step: undefined,
                    unit: undefined,
                  })
                }
                className={{
                  root: 'border-primary-80 h-8',
                }}
                data={{ cy: 'add-new-criterion' }}
              >
                <Button.Icon icon={faPlus} />
                <Button.Label>
                  {t('manage.questionForms.addCriterion')}
                </Button.Label>
              </Button>
            </>
          )}
        </FieldArray>
      </div>
    </div>
  )
}

export default CaseStudyCriteriaFields
