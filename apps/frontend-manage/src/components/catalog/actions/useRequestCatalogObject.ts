import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetCatalogCollectionsListDocument,
  RequestCatalogCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger access request creation, returns success boolean
function useRequestCatalogObject({
  objectType,
  objectId,
  onError,
}: {
  objectType: CatalogObjectType
  objectId: string | number
  onError: () => void
}) {
  const [requestCatalogCollection, { loading: requestingCatalogCollection }] =
    useMutation(RequestCatalogCollectionDocument)

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
