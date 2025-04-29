import { useMutation } from '@apollo/client'
import {
  ImportCatalogObjectDocument,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger object import, returns success boolean
function useImportCatalogObject({
  objectType,
  objectId,
  catalogCollectionId,
  onError,
}: {
  objectType: SharingObjectType
  objectId: string | number
  catalogCollectionId?: string
  onError: () => void
}) {
  const [importCatalogObject, { loading: importingCatalogObject }] =
    useMutation(ImportCatalogObjectDocument)

  if (objectType === SharingObjectType.CatalogCollection) {
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
