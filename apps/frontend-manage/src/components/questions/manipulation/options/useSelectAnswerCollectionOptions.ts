import { AnswerCollection } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

function useSelectAnswerCollectionOptions({
  collectionId,
  collections,
}: {
  collectionId: string
  collections: AnswerCollection[]
}) {
  return useMemo(() => {
    const selectedCollection = collections.find(
      (collection) => collection.id === parseInt(collectionId)
    )

    if (!selectedCollection || !selectedCollection.entries) {
      return []
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
