import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useMemo } from 'react'

function useSelectAnswerCollectionOptions({
  collectionId,
  collections,
  setAnswerCollectionEntries,
}: {
  collectionId: string
  collections: AnswerCollection[]
  setAnswerCollectionEntries?: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}) {
  return useMemo(() => {
    const selectedCollection = collections.find(
      (collection) => collection.id === parseInt(collectionId)
    )

    if (!selectedCollection || !selectedCollection.entries) {
      return []
    }

    if (setAnswerCollectionEntries) {
      setAnswerCollectionEntries(
        selectedCollection.entries.map((entry) => ({
          id: entry.id,
          value: entry.value,
        }))
      )
    }

    return selectedCollection.entries.map((entry) => ({
      label: entry.value,
      value: entry.id,
      data: { cy: `select-answer-${entry.value}` },
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, collectionId])
}

export default useSelectAnswerCollectionOptions
