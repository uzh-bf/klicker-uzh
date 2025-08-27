import { useMutation } from '@apollo/client'
import {
  CancelObjectSharingRequestDocument,
  GetCatalogObjectsDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger object sharing request, returns success boolean
function useRequestCancellationCatalogObject({
  objectType,
  objectId,
  catalogCollectionId,
  onError,
}: {
  objectType: ObjectType
  objectId: string | number
  catalogCollectionId?: string
  onError: () => void
}) {
  const [cancelObjectSharingRequest, { loading: cancellingSharingRequest }] =
    useMutation(CancelObjectSharingRequestDocument)

  const onObjectSharingRequestCancellation = async () => {
    try {
      const res = await cancelObjectSharingRequest({
        variables: { objectId: String(objectId), objectType },
        optimisticResponse: {
          cancelObjectSharingRequest: true,
        },
        update: (cache, { data }) => {
          // check if cancellation was successful
          if (!data?.cancelObjectSharingRequest) return

          // update the cache
          cache.updateQuery(
            {
              query: GetCatalogObjectsDocument,
              variables: { catalogCollectionId },
            },
            (qData) => {
              if (!qData?.getCatalogObjects) return qData
              return {
                getCatalogObjects: qData.getCatalogObjects.map((obj) =>
                  (typeof objectId === 'number' && obj.objectId === objectId) ||
                  (typeof objectId === 'string' && obj.objectUuid === objectId)
                    ? { ...obj, isRequested: false }
                    : obj
                ),
              }
            }
          )
        },
      })

      if (res.data?.cancelObjectSharingRequest) {
        return true
      } else {
        onError()
        return false
      }
    } catch (error) {
      console.error(error)
      onError()
      return false
    }
  }

  return {
    onCancellation: onObjectSharingRequestCancellation,
    cancelling: cancellingSharingRequest,
  }
}

export default useRequestCancellationCatalogObject
