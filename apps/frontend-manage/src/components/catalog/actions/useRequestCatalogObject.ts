import { useMutation } from '@apollo/client'
import {
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  ObjectType,
  RequestCatalogCollectionDocument,
  RequestCatalogObjectDocument,
} from '@klicker-uzh/graphql/dist/ops'

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
  const [requestCatalogCollection, { loading: requestingCatalogCollection }] =
    useMutation(RequestCatalogCollectionDocument)
  const [requestCatalogObject, { loading: requestingCatalogObject }] =
    useMutation(RequestCatalogObjectDocument)

  if (objectType === ObjectType.CatalogCollection) {
    const onRequestCatalogCollection = async () => {
      try {
        const res = await requestCatalogCollection({
          variables: { catalogCollectionId: objectId as string },
          update: (cache, { data }) => {
            if (!data?.requestCatalogCollection) return

            const prevCollections = cache.readQuery({
              query: GetCatalogCollectionsListDocument,
            })

            if (!prevCollections?.getCatalogCollectionsList) {
              return
            }

            const newCollections =
              prevCollections.getCatalogCollectionsList.map((collection) =>
                collection.id === objectId
                  ? data.requestCatalogCollection!
                  : collection
              )

            cache.writeQuery({
              query: GetCatalogCollectionsListDocument,
              data: {
                getCatalogCollectionsList: newCollections,
              },
            })
          },
        })

        if (res.data?.requestCatalogCollection?.id) {
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
      onRequest: onRequestCatalogCollection,
      requesting: requestingCatalogCollection,
    }
  }

  const onRequestCatalogObject = async () => {
    try {
      const res = await requestCatalogObject({
        variables: {
          objectId: String(objectId),
          objectType,
          catalogCollectionId,
        },
        update: (cache, { data }) => {
          // check if request was successful
          const requestedObject = data?.requestCatalogObject
          if (!requestedObject) return

          // update lists of answer collections
          const catalogObjects = cache.readQuery({
            query: GetCatalogObjectsDocument,
            variables: {
              catalogCollectionId,
            },
          })

          if (catalogObjects?.getCatalogObjects) {
            const updatedObjects = catalogObjects?.getCatalogObjects.map(
              (obj) => {
                if (
                  (typeof objectId === 'number' && obj.objectId === objectId) ||
                  (typeof objectId === 'string' && obj.objectUuid === objectId)
                ) {
                  return { ...obj, isRequested: true }
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

      if (res.data?.requestCatalogObject) {
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
    onRequest: onRequestCatalogObject,
    requesting: requestingCatalogObject,
  }
}

export default useRequestCatalogObject
