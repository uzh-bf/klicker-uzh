import { FieldHelperProps, FieldInputProps } from 'formik'
import { useEffect } from 'react'
import { ElementFormTypesCaseStudyCriterion } from '../types'

function CaseStudyCriterionModeMonitor({
  index,
  criterion,
  criteriaField,
  criteriaHelpers,
}: {
  index: number
  criterion: ElementFormTypesCaseStudyCriterion
  criteriaField: FieldInputProps<ElementFormTypesCaseStudyCriterion[]>
  criteriaHelpers: FieldHelperProps<ElementFormTypesCaseStudyCriterion[]>
}) {
  // if the mode of a criterion is unset, default to "range"
  useEffect(() => {
    if (typeof criterion.mode === 'undefined') {
      const newCriteria: ElementFormTypesCaseStudyCriterion[] =
        criteriaField.value.map((criterion, ix) => {
          if (ix === index) {
            return {
              ...criterion,
              mode: 'range',
            }
          }
          return criterion
        })

      criteriaHelpers.setValue(newCriteria)
    }
  }, [criterion.mode])

  return null
}

export default CaseStudyCriterionModeMonitor
