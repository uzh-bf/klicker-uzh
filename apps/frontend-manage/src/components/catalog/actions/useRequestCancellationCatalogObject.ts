import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs } from '../../../lib/trpc'

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
  const utils = trpc.useUtils()
  const cancelObjectSharingRequest =
    trpc.sharing.cancelObjectSharingRequest.useMutation()

  const onObjectSharingRequestCancellation = async () => {
    try {
      const input: RouterInputs['sharing']['cancelObjectSharingRequest'] = {
        objectId: String(objectId),
        objectType:
          objectType as unknown as RouterInputs['sharing']['cancelObjectSharingRequest']['objectType'],
      }
      const res = await cancelObjectSharingRequest.mutateAsync(input)

      if (res.cancelled) {
        utils.sharing.catalogObjects.setData(
          { catalogCollectionId },
          (queryData) => {
            if (!queryData?.catalogObjects) return queryData

            return {
              catalogObjects: queryData.catalogObjects.map((obj) =>
                (typeof objectId === 'number' && obj.objectId === objectId) ||
                (typeof objectId === 'string' && obj.objectUuid === objectId)
                  ? { ...obj, isRequested: false }
                  : obj
              ),
            }
          }
        )
        return true
      }

      onError()
      return false
    } catch (error) {
      console.error(error)
      onError()
      return false
    }
  }

  return {
    onCancellation: onObjectSharingRequestCancellation,
    cancelling: cancelObjectSharingRequest.isLoading,
  }
}

export default useRequestCancellationCatalogObject
