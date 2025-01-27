import { FieldHelperProps, FieldInputProps } from 'formik'
import { useEffect } from 'react'

function useAnswerCollectionChangeEffect({
  field,
  helpers,
  collectionAnswers,
}: {
  field: FieldInputProps<number[]>
  helpers: FieldHelperProps<number[]>
  collectionAnswers: { label: string; value: number }[]
}) {
  useEffect(() => {
    if (!field.value || !collectionAnswers || collectionAnswers.length === 0) {
      return
    }

    const newFieldValues = field.value.filter((id) =>
      collectionAnswers.map((entry) => entry.value).includes(id)
    )

    helpers.setValue(newFieldValues)
    // do not add value as a dependency --> rendering loo! - updates only on collection change desired
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAnswers])
}

export default useAnswerCollectionChangeEffect
