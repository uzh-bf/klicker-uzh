import { useApolloClient } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs } from '../../../lib/trpc'

// function to trigger object import, returns success boolean
function useCopyCatalogObject({
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
  const copyCatalogObjectToAccount =
    trpc.sharing.copyCatalogObjectToAccount.useMutation()

  if (objectType === ObjectType.CatalogCollection) {
    return {
      onCopy: async () => {
        console.error('Unsupported object type', objectType)
        onError()
      },
      copying: false,
    }
  }

  const onCopyCatalogObject = async () => {
    try {
      const input: RouterInputs['sharing']['copyCatalogObjectToAccount'] = {
        objectId: String(objectId),
        objectType:
          objectType as unknown as RouterInputs['sharing']['copyCatalogObjectToAccount']['objectType'],
        catalogCollectionId,
      }
      const res = await copyCatalogObjectToAccount.mutateAsync(input)

      if (res.copied) {
        void utils.sharing.catalogObjects.invalidate({
          catalogCollectionId,
        })
        if (objectType === ObjectType.AnswerCollection) {
          void utils.resources.answerCollectionsInfo.invalidate()
          void apolloClient.refetchQueries({
            include: [GetAnswerCollectionsInfoDocument],
          })
        }
        return true
      }
      return false
    } catch (error) {
      console.error(error)
      return false
    }
  }

  return {
    onCopy: onCopyCatalogObject,
    copying: copyCatalogObjectToAccount.isLoading,
  }
}

export default useCopyCatalogObject
