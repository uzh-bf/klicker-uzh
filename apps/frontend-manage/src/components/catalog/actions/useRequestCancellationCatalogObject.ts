import { useMutation } from '@apollo/client'
import {
  CancelAnswerCollectionRequestDocument,
  CatalogObjectType,
  GetCatalogObjectsDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger object import, returns success boolean
function useRequestCancellationCatalogObject({
  objectType,
  objectId,
  catalogCollectionId,
  onError,
}: {
  objectType: CatalogObjectType
  objectId: string | number
  catalogCollectionId?: string
  onError: () => void
}) {
  const [
    cancelAnswerCollectionRequest,
    { loading: cancellingAnswerCollectionRequest },
  ] = useMutation(CancelAnswerCollectionRequestDocument)

  if (objectType === CatalogObjectType.AnswerCollection) {
    const onAnswerCollectionRequestCancellation = async () => {
      try {
        const res = await cancelAnswerCollectionRequest({
          variables: { collectionId: objectId as number },
          optimisticResponse: {
            cancelAnswerCollectionRequest: true,
          },
          update: (cache, { data }) => {
            // check if request was successful
            const cancelledCollection = data?.cancelAnswerCollectionRequest
            if (!cancelledCollection) return

            // update list of answer collections
            const catalogObjects = cache.readQuery({
              query: GetCatalogObjectsDocument,
              variables: {
                catalogCollectionId,
              },
            })

            if (catalogObjects?.getCatalogObjects) {
              const updatedObjects = catalogObjects?.getCatalogObjects.map(
                (obj) => {
                  if (obj.id === objectId) {
                    return { ...obj, isRequested: false }
                  }

                  return obj
                }
              )

              cache.writeQuery({
                query: GetCatalogObjectsDocument,
                variables: {
                  catalogCollectionId,
                },
                data: {
                  getCatalogObjects: updatedObjects,
                },
              })
            }
          },
        })

        if (res.data?.cancelAnswerCollectionRequest) {
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
      onCancellation: onAnswerCollectionRequestCancellation,
      cancelling: cancellingAnswerCollectionRequest,
    }
  }

  return {
    onCancellation: async () => {
      console.error('Unsupported object type', objectType)
      onError()
    },
    cancelling: false,
  }
}

export default useRequestCancellationCatalogObject
