import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs } from '../../../lib/trpc'

// function to trigger access request creation, returns success boolean
function useRequestCatalogObject({
  objectType,
  objectId,
  catalogCollectionId,
  onError,
}: {
  objectType: ObjectType
  objectId: string | number
  catalogCollectionId?: string
  onError: () => void
}): { onRequest: () => Promise<boolean>; requesting: boolean } {
  const utils = trpc.useUtils()
  const requestCatalogCollection =
    trpc.sharing.requestCatalogCollection.useMutation()
  const requestCatalogObject = trpc.sharing.requestCatalogObject.useMutation()

  if (objectType === ObjectType.CatalogCollection) {
    const onRequestCatalogCollection = async () => {
      try {
        const input: RouterInputs['sharing']['requestCatalogCollection'] = {
          catalogCollectionId: objectId as string,
        }
        const res = await requestCatalogCollection.mutateAsync(input)

        if (res.catalogCollection?.id) {
          utils.sharing.catalogCollections.setData(undefined, (queryData) => {
            if (!queryData?.catalogCollections) return queryData

            return {
              catalogCollections: queryData.catalogCollections.map(
                (collection) =>
                  collection.id === objectId
                    ? res.catalogCollection!
                    : collection
              ),
            }
          })
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
      onRequest: onRequestCatalogCollection,
      requesting: requestCatalogCollection.isLoading,
    }
  }

  const onRequestCatalogObject = async () => {
    try {
      const input: RouterInputs['sharing']['requestCatalogObject'] = {
        objectId: String(objectId),
        objectType:
          objectType as unknown as RouterInputs['sharing']['requestCatalogObject']['objectType'],
        catalogCollectionId,
      }
      const res = await requestCatalogObject.mutateAsync(input)

      if (res.requested) {
        utils.sharing.catalogObjects.setData(
          { catalogCollectionId },
          (queryData) => {
            if (!queryData?.catalogObjects) return queryData

            return {
              catalogObjects: queryData.catalogObjects.map((obj) =>
                (typeof objectId === 'number' && obj.objectId === objectId) ||
                (typeof objectId === 'string' && obj.objectUuid === objectId)
                  ? { ...obj, isRequested: true }
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
    onRequest: onRequestCatalogObject,
    requesting: requestCatalogObject.isLoading,
  }
}

export default useRequestCatalogObject
