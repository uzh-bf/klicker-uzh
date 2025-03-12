import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionsListDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  TransferObjectOwnershipDocument,
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
  onTransfer: (shortnameOrEmail: string) => Promise<boolean>
  transferring: boolean
} {
  const [transferObjectOwnership, { loading: transferringOwnership }] =
    useMutation(TransferObjectOwnershipDocument)

  const onTransfer = async (shortnameOrEmail: string) => {
    try {
      const res = await transferObjectOwnership({
        variables: {
          objectId: String(objectId),
          objectType,
          shortnameOrEmail,
        },
        refetchQueries: [
          // use refetch query instead of cache update, because new owner permissions might also
          // be removed in addition to the added new admin permission for the previous owner
          {
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          },
          ...(objectType === CatalogObjectType.CatalogCollection
            ? [GetCatalogCollectionsListDocument]
            : []),
          ...(objectType === CatalogObjectType.AnswerCollection
            ? [
                {
                  query: GetCatalogObjectsDocument,
                  variables: { catalogCollectionId },
                },
                GetAnswerCollectionsInfoDocument,
                GetCatalogSharingRequestsDocument,
              ]
            : []),
        ],
      })

      if (res.data?.transferObjectOwnership) {
        return true
      } else {
        onError()
        return false
      }
    } catch (error) {
      console.error(error)
      onError()
      return false
    }
  }

  return {
    onTransfer,
    transferring: transferringOwnership,
  }
}

export default useTransferObjectOwnership
