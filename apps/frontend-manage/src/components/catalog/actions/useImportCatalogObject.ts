import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  GetUserElementsDocument,
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
  const [importCatalogObject, { loading: importingCatalogObject }] =
    useMutation(ImportCatalogObjectDocument)

  if (objectType === ObjectType.CatalogCollection) {
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
        refetchQueries: [
          ...(objectType === ObjectType.AnswerCollection
            ? [{ query: GetAnswerCollectionsInfoDocument }]
            : []),
          ...(objectType === ObjectType.Element
            ? [{ query: GetUserElementsDocument }]
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
    importing: importingCatalogObject,
  }
}

export default useImportCatalogObject
