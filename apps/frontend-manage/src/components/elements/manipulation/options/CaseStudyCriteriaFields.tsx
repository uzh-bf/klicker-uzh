import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  FormikNumberField,
  FormikTextField,
  H3,
  NumberField,
} from '@uzh-bf/design-system'
import { FieldArray, useField } from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import {
  ElementFormTypesCaseStudy,
  ElementFormTypesCaseStudyCriterion,
} from '../types'
import CaseStudyCriterionModeMonitor from './CaseStudyCriterionModeMonitor'

function CaseStudyCriteriaFields({ disabled }: { disabled: boolean }) {
  const t = useTranslations()
  const [criteriaField, _, criteriaHelpers] =
    useField<ElementFormTypesCaseStudyCriterion[]>('options.criteria')
  const [casesField, ___, casesHelpers] =
    useField<ElementFormTypesCaseStudy['options']['cases']>('options.cases')

  return (
    <div>
      <H3>{t('shared.generic.criteria')}</H3>
      <div className="mb-2">
        {t('manage.elements.caseStudyCriteriaDescription')}
      </div>
      <div className="flex flex-col gap-3">
        <FieldArray name="options.criteria">
          {({ push, remove }) => (
            <>
              {criteriaField.value?.map((criterion, index) => (
                <div
                  key={criterion.id}
                  className="rounded-lg border bg-gray-50 p-3 shadow-sm"
                >
                  {/* // TODO: remove this component, which is only required to migrate old local storage content */}
                  <CaseStudyCriterionModeMonitor
                    index={index}
                    criterion={criterion}
                    criteriaField={criteriaField}
                    criteriaHelpers={criteriaHelpers}
                  />
                  <div className="mb-1 flex flex-row items-center justify-between">
                    <div className="font-medium">
                      <span className="mr-1 font-bold">
                        {t('shared.generic.criterionN', { number: index + 1 })}:
                      </span>

                      {criterion.mode === 'range'
                        ? t('manage.elements.caseStudyRangeCriterion')
                        : t('manage.elements.caseStudyStepCriterion')}
                    </div>
                    {!disabled ? (
                      <Button
                        destructive
                        onClick={() => {
                          const removedCriterionId =
                            criteriaField.value?.[index]?.id
                          remove(index)

                          // Remove all solutions for this criterion
                          const newCases = casesField.value?.map((caseItem) => {
                            if (
                              !('solutions' in caseItem) ||
                              !caseItem.solutions
                            ) {
                              return caseItem
                            }

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

                          casesHelpers.setValue(newCases)
                        }}
                        className={{
                          root: 'h-7 w-7',
                        }}
                        data={{ cy: `remove-criterion-${index}` }}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </Button>
                    ) : null}
                  </div>

                  <FormikTextField
                    required
                    hideError
                    disabled={disabled}
                    name={`options.criteria.${index}.name`}
                    label={t('shared.generic.name')}
                    tooltip={t('manage.elements.caseStudyCriteriaNameTooltip')}
                    className={{
                      root: 'mb-2 w-full',
                      tooltip: 'max-w-120',
                    }}
                    maxLength={100}
                    data={{ cy: `criterion-${index}-name` }}
                  />

                  {(criterion.mode === 'range' ||
                    typeof criterion.mode === 'undefined') && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                      <FormikNumberField
                        required
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.min`}
                        label={t('shared.generic.minimumShort')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaMinTooltip'
                        )}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-min` }}
                      />
                      <FormikNumberField
                        required
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.max`}
                        label={t('shared.generic.maximumShort')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaMaxTooltip'
                        )}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-max` }}
                      />
                      <FormikNumberField
                        required
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.step`}
                        label={t('shared.generic.step')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaStepTooltip'
                        )}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-step` }}
                      />
                      <FormikTextField
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.unit`}
                        label={t('shared.generic.unit')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaUnitTooltip'
                        )}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        maxLength={10}
                        data={{ cy: `criterion-${index}-unit` }}
                      />
                    </div>
                  )}

                  {criterion.mode === 'steps' && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                      <FormikTextField
                        required
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.labels.min`}
                        label={t('shared.generic.lowerEnd')}
                        placeholder={t('shared.generic.textInput')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaMinLabelTooltip'
                        )}
                        maxLength={100}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-min-label` }}
                      />
                      <FormikTextField
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.labels.mid`}
                        label={t('shared.generic.midValue')}
                        placeholder={t('shared.generic.textInput')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaMidLabelTooltip'
                        )}
                        maxLength={100}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-mid-label` }}
                      />
                      <FormikTextField
                        required
                        hideError
                        disabled={disabled}
                        name={`options.criteria.${index}.labels.max`}
                        label={t('shared.generic.upperEnd')}
                        placeholder={t('shared.generic.textInput')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaMaxLabelTooltip'
                        )}
                        maxLength={100}
                        className={{
                          root: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-max-label` }}
                      />
                      <NumberField
                        required
                        hideError
                        disabled={disabled}
                        value={
                          criteriaField.value[index].max &&
                          criteriaField.value[index].min
                            ? criteriaField.value[index].max +
                              1 -
                              criteriaField.value[index].min
                            : ''
                        }
                        label={t('shared.generic.steps')}
                        tooltip={t(
                          'manage.elements.caseStudyCriteriaStepsTooltip'
                        )}
                        className={{
                          field: 'w-full',
                          tooltip: 'max-w-120',
                        }}
                        data={{ cy: `criterion-${index}-steps` }}
                        onChange={(newValue) => {
                          const steps = parseInt(newValue, 10)
                          const newCriteria = criteriaField.value.map(
                            (criteria, i) => {
                              if (i === index) {
                                return {
                                  ...criteria,
                                  max:
                                    newValue === '' || isNaN(steps)
                                      ? undefined
                                      : steps,
                                }
                              }
                              return criteria
                            }
                          )
                          criteriaHelpers.setValue(newCriteria)
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
              {!disabled ? (
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() =>
                      push({
                        id: nanoid(),
                        mode: 'range',
                        name: undefined,
                        min: undefined,
                        max: undefined,
                        step: undefined,
                        unit: undefined,
                      })
                    }
                    className={{
                      root: 'border-primary-80 h-9 w-full sm:w-1/2',
                    }}
                    data={{ cy: 'add-range-criterion' }}
                  >
                    <Button.Icon icon={faPlus} />
                    <Button.Label>
                      {t('manage.elements.addRangeCriterion')}
                    </Button.Label>
                  </Button>
                  <Button
                    onClick={() =>
                      push({
                        id: nanoid(),
                        mode: 'steps',
                        name: undefined,
                        min: 1,
                        max: 5,
                        step: 1,
                        unit: undefined,
                        labels: {
                          min: undefined,
                          max: undefined,
                        },
                      })
                    }
                    className={{
                      root: 'border-primary-80 h-9 w-full sm:w-1/2',
                    }}
                    data={{ cy: 'add-steps-criterion' }}
                  >
                    <Button.Icon icon={faPlus} />
                    <Button.Label>
                      {t('manage.elements.addStepsCriterion')}
                    </Button.Label>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </FieldArray>
      </div>
    </div>
  )
}

export default CaseStudyCriteriaFields
