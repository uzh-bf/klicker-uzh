import { FieldInputProps } from 'formik'
import { Dispatch, SetStateAction, useMemo } from 'react'

function useSelectedAnswerEntry({
  field,
  collectionAnswers,
  setSelectedItems,
}: {
  field: FieldInputProps<number[]>
  collectionAnswers: { label: string; value: number }[]
  setSelectedItems?: Dispatch<SetStateAction<{ id: number; name: string }[]>>
}) {
  return useMemo(() => {
    if (!field.value) {
      return []
    }

    const selectedAnswers = collectionAnswers.filter((entry) =>
      field.value.includes(entry.value)
    )

    if (setSelectedItems) {
      setSelectedItems(
        selectedAnswers.map((entry) => ({ id: entry.value, name: entry.label }))
      )
    }

    return selectedAnswers
  }, [collectionAnswers, field.value, setSelectedItems])
}

export default useSelectedAnswerEntry
