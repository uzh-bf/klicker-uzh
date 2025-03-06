import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  RequestAnswerCollectionDocument,
  RequestCatalogCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger access request creation, returns success boolean
function useRequestCatalogObject({
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
  const [requestCatalogCollection, { loading: requestingCatalogCollection }] =
    useMutation(RequestCatalogCollectionDocument)
  const [requestAnswerCollection, { loading: requestingAnswerCollection }] =
    useMutation(RequestAnswerCollectionDocument)

  if (objectType === CatalogObjectType.CatalogCollection) {
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
          return false
        }
      } catch (error) {
        console.error(error)
        return false
      }
    }

    return {
      onRequest: onRequestCatalogCollection,
      requesting: requestingCatalogCollection,
    }
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    const onRequestAnswerCollection = async () => {
      try {
        const res = await requestAnswerCollection({
          variables: { collectionId: objectId as number, catalogCollectionId },
          update: (cache, { data }) => {
            // check if request was successful
            const requestedCollection = data?.requestAnswerCollection
            if (!requestedCollection) return

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
                  if (obj.id === objectId) {
                    return requestedCollection
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

        if (res.data?.requestAnswerCollection?.id) {
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
      onRequest: onRequestAnswerCollection,
      requesting: requestingAnswerCollection,
    }
  }

  return {
    onRequest: async () => {
      console.error('Unsupported object type', objectType)
      onError()
    },
    requesting: false,
  }
}

export default useRequestCatalogObject
