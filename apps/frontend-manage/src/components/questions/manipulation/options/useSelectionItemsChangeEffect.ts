import { FieldHelperProps, FieldInputProps } from 'formik'
import { useEffect } from 'react'
import { ElementFormTypesSelection } from '../types'

function useSelectionItemsChangeEffect({
  items,
  solutions,
  solutionHelpers,
}: {
  items: FieldInputProps<
    ElementFormTypesSelection['options']['manuallyCreatedItems']
  >
  solutions: FieldInputProps<
    ElementFormTypesSelection['options']['correctAnswers']
  >
  solutionHelpers: FieldHelperProps<
    ElementFormTypesSelection['options']['correctAnswers']
  >
}) {
  useEffect(() => {
    if (!solutions.value || !items.value || items.value.length === 0) {
      return
    }

    const newFieldValues = solutions.value.filter((id) =>
      items.value!.map((item) => item.id).includes(id)
    )

    solutionHelpers.setValue(newFieldValues)
    // do not add value as a dependency --> rendering loo! - updates only on collection change desired
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.value])
}

export default useSelectionItemsChangeEffect
