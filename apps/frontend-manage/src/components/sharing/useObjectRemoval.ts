import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  RemoveAnswerCollectionDocument,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'

function useObjectRemoval({
  objectType,
  objectId,
  onError,
}: {
  objectType: SharingObjectType
  objectId: string | number
  onError: () => void
}): {
  onRemove: () => Promise<boolean>
  removing: boolean
} {
  const [removeAnswerCollection, { loading: removingAnswerCollection }] =
    useMutation(RemoveAnswerCollectionDocument)

  if (objectType === SharingObjectType.AnswerCollection) {
    const onRemoveAnswerCollection = async () => {
      try {
        const res = await removeAnswerCollection({
          variables: { collectionId: objectId as number },
          optimisticResponse: {
            removeAnswerCollection: objectId as number,
          },
          refetchQueries: [{ query: GetAnswerCollectionsInfoDocument }],
        })

        if (
          typeof res.data?.removeAnswerCollection !== 'undefined' &&
          res.data?.removeAnswerCollection !== null
        ) {
          return true
        } else {
          return false
        }
      } catch (error) {
        console.error(error)
        return false
      }
    }

    return {
      onRemove: onRemoveAnswerCollection,
      removing: removingAnswerCollection,
    }
  }

  return {
    onRemove: async () => {
      console.error('Unsupported object type', objectType)
      onError()
      return false
    },
    removing: false,
  }
}

export default useObjectRemoval
