import { FieldInputProps } from 'formik'
import { Dispatch, SetStateAction, useMemo } from 'react'
import { ElementFormTypesSelection } from '../types'

function useSelectedAnswerEntry({
  field,
  collectionAnswers,
  itemSelectionMode,
  setSelectedItems,
}: {
  field: FieldInputProps<ElementFormTypesSelection['options']['correctAnswers']>
  collectionAnswers: { label: string; value: number }[]
  itemSelectionMode: 'existing' | 'new'
  setSelectedItems?: Dispatch<SetStateAction<{ id: number; name: string }[]>>
}) {
  return useMemo(() => {
    if (
      field.value === null ||
      typeof field.value === 'undefined' ||
      itemSelectionMode === 'new'
    ) {
      return []
    }

    const selectedAnswers = collectionAnswers.filter((entry) =>
      field.value!.includes(entry.value)
    )

    if (setSelectedItems) {
      setSelectedItems(
        selectedAnswers.map((entry) => ({ id: entry.value, name: entry.label }))
      )
    }

    return selectedAnswers
  }, [collectionAnswers, field.value, itemSelectionMode, setSelectedItems])
}

export default useSelectedAnswerEntry
