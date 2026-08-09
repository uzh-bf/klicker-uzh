import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useMemo } from 'react'

function useSelectAnswerCollectionOptions({
  collectionId,
  collections,
  setAnswerCollectionEntries,
}: {
  collectionId?: string
  collections: Pick<AnswerCollection, 'id' | 'name' | 'entries'>[]
  setAnswerCollectionEntries: Dispatch<
    SetStateAction<{ id: number; value: string }[]>
  >
}) {
  return useMemo(() => {
    if (typeof collectionId === 'undefined') {
      return []
    }

    const selectedCollection = collections.find(
      (collection) => collection.id === parseInt(collectionId)
    )

    if (!selectedCollection || !selectedCollection.entries) {
      return []
    }

    setAnswerCollectionEntries(
      selectedCollection.entries.map((entry) => ({
        id: entry.id,
        value: entry.value,
      }))
    )

    return selectedCollection.entries.map((entry) => ({
      label: entry.value,
      value: entry.id,
      data: { cy: `select-answer-${entry.value}` },
    }))
  }, [collections, collectionId, setAnswerCollectionEntries])
}

export default useSelectAnswerCollectionOptions
