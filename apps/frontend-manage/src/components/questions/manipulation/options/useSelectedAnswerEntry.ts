import { FieldInputProps } from 'formik'
import { useMemo } from 'react'

function useSelectedAnswerEntry({
  field,
  collectionAnswers,
}: {
  field: FieldInputProps<number[]>
  collectionAnswers: { label: string; value: number }[]
}) {
  return useMemo(() => {
    if (!field.value) {
      return []
    }

    return collectionAnswers.filter((entry) =>
      field.value.includes(entry.value)
    )
  }, [collectionAnswers, field.value])
}

export default useSelectedAnswerEntry
