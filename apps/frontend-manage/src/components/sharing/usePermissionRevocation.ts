import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  RevokeAnswerCollectionAccessDocument,
  RevokeCatalogCollectionAccessDocument,
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
  const [
    revokeCatalogCollectionAccess,
    { loading: revokingCatalogCollectionAccess },
  ] = useMutation(RevokeCatalogCollectionAccessDocument)

  if (objectType === CatalogObjectType.CatalogCollection) {
    const onRequestCatalogCollection = async ({
      permissionId,
    }: {
      permissionId: number
    }) => {
      try {
        const res = await revokeCatalogCollectionAccess({
          variables: {
            catalogCollectionId: objectId as string,
            permissionId,
          },
          update: (cache, { data }) => {
            const prevPermissions = cache.readQuery({
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
            })

            const removedId = data?.revokeCatalogCollectionAccess
            if (
              !prevPermissions?.getObjectPermissions ||
              typeof removedId === 'undefined'
            ) {
              return
            }

            cache.writeQuery({
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
              data: {
                getObjectPermissions:
                  prevPermissions.getObjectPermissions.filter(
                    (permission) => permission.permissionId !== removedId
                  ),
              },
            })
          },
          refetchQueries: [
            {
              query: GetCatalogCollectionInfoDocument,
              variables: { catalogCollectionId },
            },
            {
              query: GetCatalogObjectsDocument,
              variables: { catalogCollectionId },
            },
            GetCatalogSharingRequestsDocument,
          ],
        })

        if (res.data?.revokeCatalogCollectionAccess) {
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
      onPermissionRevocation: onRequestCatalogCollection,
      permissionRevoking: revokingCatalogCollectionAccess,
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
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
            })

            const removedId = data?.revokeAnswerCollectionAccess
            if (
              !prevPermissions?.getObjectPermissions ||
              typeof removedId === 'undefined'
            ) {
              return
            }

            cache.writeQuery({
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
              data: {
                getObjectPermissions:
                  prevPermissions.getObjectPermissions.filter(
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
