import { ObjectType } from '@lib/constants/sharingEnums'
import { useState } from 'react'
import { trpc, type RouterInputs } from '../../../lib/trpc'

// function to trigger object import, returns success boolean
function useImportCatalogObject({
  objectType,
  objectId,
  catalogCollectionId,
}: {
  objectType: ObjectType
  objectId: string | number
  catalogCollectionId?: string
}) {
  const utils = trpc.useUtils()
  const importCatalogObject = trpc.sharing.importCatalogObject.useMutation()
  const [importPending, setImportPending] = useState(false)
  const importing = importCatalogObject.isLoading || importPending

  if (objectType !== ObjectType.AnswerCollection) {
    return {
      onImport: async () => {
        console.error('Unsupported object type', objectType)
        return false
      },
      importing: false,
    }
  }

  const onImportCatalogObject = async () => {
    if (importing) return false

    let releasePending = true
    setImportPending(true)

    try {
      const input: RouterInputs['sharing']['importCatalogObject'] = {
        objectId: String(objectId),
        objectType:
          objectType as unknown as RouterInputs['sharing']['importCatalogObject']['objectType'],
        catalogCollectionId,
      }
      const res = await importCatalogObject.mutateAsync(input)

      if (res.imported) {
        await Promise.all([
          utils.sharing.catalogObjects
            .invalidate({
              catalogCollectionId,
            })
            .catch(console.error),
          utils.resources.answerCollectionsInfo
            .invalidate()
            .catch(console.error),
        ])
        releasePending = false
        return true
      }
      return false
    } catch (error) {
      console.error(error)
      return false
    } finally {
      if (releasePending) {
        setImportPending(false)
      }
    }
  }

  return {
    onImport: onImportCatalogObject,
    importing,
  }
}

export default useImportCatalogObject
