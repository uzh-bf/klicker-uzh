import { useApolloClient } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs } from '../../../lib/trpc'

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
  const apolloClient = useApolloClient()
  const utils = trpc.useUtils()
  const importCatalogObject = trpc.sharing.importCatalogObject.useMutation()

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
      const input: RouterInputs['sharing']['importCatalogObject'] = {
        objectId: String(objectId),
        objectType:
          objectType as unknown as RouterInputs['sharing']['importCatalogObject']['objectType'],
        catalogCollectionId,
      }
      const res = await importCatalogObject.mutateAsync(input)

      if (res.imported) {
        void utils.sharing.catalogObjects.invalidate({
          catalogCollectionId,
        })
        void apolloClient.refetchQueries({
          include: [GetAnswerCollectionsInfoDocument],
        })
        return true
      }
      return false
    } catch (error) {
      console.error(error)
      return false
    }
  }

  return {
    onImport: onImportCatalogObject,
    importing: importCatalogObject.isLoading,
  }
}

export default useImportCatalogObject
