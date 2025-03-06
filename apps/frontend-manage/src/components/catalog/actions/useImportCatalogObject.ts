import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  ImportAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to trigger object import, returns success boolean
function useImportCatalogObject({
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
  const [importAnswerCollection, { loading: importingAnswerCollection }] =
    useMutation(ImportAnswerCollectionDocument)

  if (objectType === CatalogObjectType.AnswerCollection) {
    const onImportAnswerCollection = async () => {
      try {
        const res = await importAnswerCollection({
          variables: { collectionId: objectId as number, catalogCollectionId },
        })

        if (res.data?.importAnswerCollection) {
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
      onImport: onImportAnswerCollection,
      importing: importingAnswerCollection,
    }
  }

  return {
    onImport: async () => {
      console.error('Unsupported object type', objectType)
      onError()
    },
    importing: false,
  }
}

export default useImportCatalogObject
