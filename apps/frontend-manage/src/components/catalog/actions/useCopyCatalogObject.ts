import { useMutation } from '@apollo/client'
import {
  CopyCatalogObjectToAccountDocument,
  GetAnswerCollectionsInfoDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'

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
  // TODO: add query update
  const [copyCatalogObjectToAccount, { loading: copyingCatalogObject }] =
    useMutation(CopyCatalogObjectToAccountDocument)

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
      const res = await copyCatalogObjectToAccount({
        variables: {
          objectId: String(objectId),
          objectType,
          catalogCollectionId,
        },
        refetchQueries: [
          ...(objectType === ObjectType.AnswerCollection
            ? [{ query: GetAnswerCollectionsInfoDocument }]
            : []),
        ],
      })

      if (res.data?.copyCatalogObjectToAccount) {
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
    onCopy: onCopyCatalogObject,
    copying: copyingCatalogObject,
  }
}

export default useCopyCatalogObject
