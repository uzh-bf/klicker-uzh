import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetDerivedObjectPermissionsDocument,
  GetObjectPermissionsDocument,
  RevokeObjectAccessDocument,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'

// function to revoke the permission for a certain object
function usePermissionRevocation({
  objectId,
  objectType,
  catalogCollectionId,
  onError,
}: {
  objectId: string | number
  objectType: SharingObjectType
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
  const [revokeObjectAccess, { loading: revokingObjectAccess }] = useMutation(
    RevokeObjectAccessDocument
  )

  const onPermissionRevocation = async ({
    permissionId,
  }: {
    permissionId: number
  }) => {
    try {
      const res = await revokeObjectAccess({
        variables: {
          permissionId,
          objectId: String(objectId),
          objectType,
        },
        update: (cache, { data }) => {
          const prevPermissions = cache.readQuery({
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          })

          const removedId = data?.revokeObjectAccess
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
              getObjectPermissions: prevPermissions.getObjectPermissions.filter(
                (permission) => permission.permissionId !== removedId
              ),
            },
          })
        },
        refetchQueries: [
          GetCatalogSharingRequestsDocument,
          {
            query: GetDerivedObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          },
          {
            query: GetCatalogObjectsDocument,
            variables: { catalogCollectionId },
          },
          ...(objectType === SharingObjectType.CatalogCollection
            ? [
                {
                  query: GetCatalogCollectionInfoDocument,
                  variables: { catalogCollectionId: objectId },
                },
              ]
            : []),
          ...(objectType === SharingObjectType.AnswerCollection
            ? [GetAnswerCollectionsInfoDocument]
            : []),
        ],
      })

      if (res.data?.revokeObjectAccess) {
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
    onPermissionRevocation,
    permissionRevoking: revokingObjectAccess,
  }
}

export default usePermissionRevocation
