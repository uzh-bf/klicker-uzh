import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  RevokeAnswerCollectionAccessDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to revoke the permission for a certain object
function usePermissionRevocation({
  objectId,
  objectType,
  catalogCollectionId,
  onError,
}: {
  objectId: string | number
  objectType: CatalogObjectType
  catalogCollectionId?: string
  onError: () => void
}): {
  onPermissionRevocation: ({
    permissionId,
  }: {
    permissionId: number
  }) => Promise<boolean>
  permissionRevoking: boolean
} {
  const [
    revokeAnswerCollectionAccess,
    { loading: revokingAnswerCollectionAccess },
  ] = useMutation(RevokeAnswerCollectionAccessDocument)

  if (objectType === CatalogObjectType.CatalogCollection) {
    // TODO: implement
    return {
      onPermissionRevocation: async () => {
        console.error('Unsupported object type', objectType)
        onError()
        return false
      },
      permissionRevoking: false,
    }
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    const onRequestAnswerCollection = async ({
      permissionId,
    }: {
      permissionId: number
    }) => {
      try {
        const res = await revokeAnswerCollectionAccess({
          variables: {
            collectionId: objectId as number,
            permissionId,
          },
          update: (cache, { data }) => {
            const prevPermissions = cache.readQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId: objectId as number,
              },
            })

            const removedId = data?.revokeAnswerCollectionAccess
            if (
              !prevPermissions?.getAnswerCollectionPermissions ||
              typeof removedId === 'undefined'
            ) {
              return
            }

            cache.writeQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId: objectId as number,
              },
              data: {
                getAnswerCollectionPermissions:
                  prevPermissions.getAnswerCollectionPermissions.filter(
                    (permission) => permission.permissionId !== removedId
                  ),
              },
            })
          },
          refetchQueries: [
            GetAnswerCollectionsInfoDocument,
            GetCatalogSharingRequestsDocument,
            {
              query: GetCatalogObjectsDocument,
              variables: { catalogCollectionId },
            },
          ],
        })

        if (res.data?.revokeAnswerCollectionAccess) {
          return true
        } else {
          return false
        }
      } catch (error) {
        console.error(error)
        onError()
        return false
      }
    }

    return {
      onPermissionRevocation: onRequestAnswerCollection,
      permissionRevoking: revokingAnswerCollectionAccess,
    }
  }

  return {
    onPermissionRevocation: async () => {
      console.error('Unsupported object type', objectType)
      onError()
      return false
    },
    permissionRevoking: false,
  }
}

export default usePermissionRevocation
