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
  const criteria = criteriaField.value
  const setCriteria = criteriaHelpers.setValue

  useEffect(() => {
    if (typeof criterion.mode === 'undefined') {
      const newCriteria: ElementFormTypesCaseStudyCriterion[] = criteria.map(
        (criterion, ix) => {
          if (ix === index) {
            return {
              ...criterion,
              mode: 'range',
            }
          }
          return criterion
        }
      )

      setCriteria(newCriteria)
    }
  }, [criteria, criterion.mode, index, setCriteria])

  return null
}

export default CaseStudyCriterionModeMonitor
