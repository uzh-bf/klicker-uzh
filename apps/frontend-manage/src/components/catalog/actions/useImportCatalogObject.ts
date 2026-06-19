import { ObjectType } from '@lib/constants/sharingEnums'
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
        void utils.resources.answerCollectionsInfo.invalidate()
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
