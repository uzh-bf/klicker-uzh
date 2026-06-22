import { ObjectType } from '@lib/constants/sharingEnums'
import { useState } from 'react'
import { trpc, type RouterInputs } from '../../../lib/trpc'

// function to trigger object import, returns success boolean
function useCopyCatalogObject({
  objectType,
  objectId,
  catalogCollectionId,
}: {
  objectType: ObjectType
  objectId: string | number
  catalogCollectionId?: string
}) {
  const utils = trpc.useUtils()
  const copyCatalogObjectToAccount =
    trpc.sharing.copyCatalogObjectToAccount.useMutation()
  const [copyPending, setCopyPending] = useState(false)
  const copying = copyCatalogObjectToAccount.isLoading || copyPending

  if (objectType === ObjectType.CatalogCollection) {
    return {
      onCopy: async () => {
        console.error('Unsupported object type', objectType)
        return false
      },
      copying: false,
    }
  }

  const onCopyCatalogObject = async () => {
    if (copying) return false

    let releasePending = true
    setCopyPending(true)

    try {
      const input: RouterInputs['sharing']['copyCatalogObjectToAccount'] = {
        objectId: String(objectId),
        objectType:
          objectType as unknown as RouterInputs['sharing']['copyCatalogObjectToAccount']['objectType'],
        catalogCollectionId,
      }
      const res = await copyCatalogObjectToAccount.mutateAsync(input)

      if (res.copied) {
        const invalidations = [
          utils.sharing.catalogObjects
            .invalidate({
              catalogCollectionId,
            })
            .catch(console.error),
        ]
        if (objectType === ObjectType.AnswerCollection) {
          invalidations.push(
            utils.resources.answerCollectionsInfo
              .invalidate()
              .catch(console.error)
          )
        }
        await Promise.all(invalidations)
        releasePending = false
        return true
      }
      return false
    } catch (error) {
      console.error(error)
      return false
    } finally {
      if (releasePending) {
        setCopyPending(false)
      }
    }
  }

  return {
    onCopy: onCopyCatalogObject,
    copying,
  }
}

export default useCopyCatalogObject
