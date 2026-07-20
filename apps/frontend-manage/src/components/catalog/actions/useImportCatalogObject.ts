import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  ImportCatalogObjectDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger object import, returns success boolean
function useImportCatalogObject({
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
  const [importCatalogObject, { loading: importing }] = useMutation(
    ImportCatalogObjectDocument
  )

  if (objectType !== ObjectType.AnswerCollection) {
    return {
      onImport: async () => {
        console.error('Unsupported object type', objectType)
        onError()
      },
      importing: false,
    }
  }

  const onImportCatalogObject = async () => {
    try {
      const res = await importCatalogObject({
        variables: {
          objectId: String(objectId),
          objectType,
          catalogCollectionId,
        },
        // generic return type supporting multiple object types is not available
        // proper cache update therefore impractical -> refetch query is acceptable here
        refetchQueries: [
          ...(objectType === ObjectType.AnswerCollection
            ? [{ query: GetAnswerCollectionsInfoDocument }]
            : []),
        ],
      })

      if (res.data?.importCatalogObject) {
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
    onImport: onImportCatalogObject,
    importing,
  }
}

export default useImportCatalogObject
