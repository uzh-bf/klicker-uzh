import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  TransferCatalogCollectionOwnershipDocument,
  TransferCollectionOwnershipDocument,
} from '@klicker-uzh/graphql/dist/ops'

function useTransferObjectOwnership({
  objectType,
  objectId,
  catalogCollectionId,
  onError,
}: {
  objectType: CatalogObjectType
  objectId: string | number
  catalogCollectionId?: string
  onError: () => void
}): {
  onTransfer: (usernameOrEmail: string) => Promise<boolean>
  transferring: boolean
} {
  const [
    transferCatalogCollectionOwnership,
    { loading: transferringCatalogCollection },
  ] = useMutation(TransferCatalogCollectionOwnershipDocument)
  const [
    transferCollectionOwnership,
    { loading: transferringAnswerCollection },
  ] = useMutation(TransferCollectionOwnershipDocument)

  if (objectType === CatalogObjectType.CatalogCollection) {
    const onTransferOwnershipCatalogCollection = async (
      usernameOrEmail: string
    ) => {
      try {
        const res = await transferCatalogCollectionOwnership({
          variables: {
            catalogCollectionId: objectId as string,
            usernameOrEmail,
          },
          refetchQueries: [
            // use refetch query instead of cache update, because new owner permissions might also
            // be removed in addition to the added new admin permission for the previous owner
            {
              query: GetObjectPermissionsDocument,
              variables: { objectId, objectType },
            },
            GetCatalogCollectionsListDocument,
          ],
        })

        if (res.data?.transferCatalogCollectionOwnership) {
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
      onTransfer: onTransferOwnershipCatalogCollection,
      transferring: transferringCatalogCollection,
    }
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    const onTransferOwnershipAnswerCollection = async (
      usernameOrEmail: string
    ) => {
      try {
        const res = await transferCollectionOwnership({
          variables: {
            collectionId: objectId as number,
            usernameOrEmail,
          },
          refetchQueries: [
            GetAnswerCollectionsInfoDocument,
            GetCatalogSharingRequestsDocument,
            {
              // use refetch query instead of cache update, because new owner permissions might also
              // be removed in addition to the added new admin permission for the previous owner
              query: GetObjectPermissionsDocument,
              variables: { objectId, objectType },
            },
            {
              query: GetCatalogObjectsDocument,
              variables: { catalogCollectionId },
            },
          ],
        })

        if (res.data?.transferCollectionOwnership) {
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
      onTransfer: onTransferOwnershipAnswerCollection,
      transferring: transferringAnswerCollection,
    }
  }

  return {
    onTransfer: async () => {
      console.error('Unsupported object type', objectType)
      onError()
      return false
    },
    transferring: false,
  }
}

export default useTransferObjectOwnership
