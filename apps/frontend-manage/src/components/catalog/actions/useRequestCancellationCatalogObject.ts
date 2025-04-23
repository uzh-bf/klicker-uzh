import { useMutation } from '@apollo/client'
import {
  CancelObjectSharingRequestDocument,
  CatalogObjectType,
  GetCatalogObjectsDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger object sharing request, returns success boolean
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
          // check if request was successful
          const cancelledCollection = data?.cancelObjectSharingRequest
          if (!cancelledCollection) return

          // update list of catalog objects
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
