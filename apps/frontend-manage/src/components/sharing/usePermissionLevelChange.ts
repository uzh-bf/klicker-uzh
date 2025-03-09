import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  ChangePermissionLevelDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'

// function to change the permission level for a certain object
function usePermissionLevelChange({
  objectId,
  objectType,
  catalogCollectionId,
}: {
  objectId: string | number
  objectType: CatalogObjectType
  catalogCollectionId?: string
}): {
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
  }) => Promise<boolean>
  permissionChanging: boolean
} {
  const [changePermissionLevel, { loading: permissionLevelChanging }] =
    useMutation(ChangePermissionLevelDocument)

  const onPermissionLevelChange = async ({
    permissionId,
    newPermissionLevel,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
  }) => {
    try {
      const res = await changePermissionLevel({
        variables: {
          objectId: String(objectId),
          objectType,
          permissionId,
          permissionLevel: newPermissionLevel,
        },
        update: (cache, { data }) => {
          if (!data?.changePermissionLevel) return

          const prevPermissions = cache.readQuery({
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          })

          if (!prevPermissions?.getObjectPermissions) {
            return
          }

          cache.writeQuery({
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
            data: {
              getObjectPermissions: prevPermissions.getObjectPermissions.map(
                (permission) =>
                  permission.permissionId === permissionId
                    ? {
                        ...permission,
                        permissionLevel: newPermissionLevel,
                      }
                    : permission
              ),
            },
          })
        },
        refetchQueries: [
          {
            query: GetCatalogObjectsDocument,
            variables: { catalogCollectionId },
          },
          GetCatalogSharingRequestsDocument,
          ...(objectType === CatalogObjectType.CatalogCollection
            ? [
                {
                  query: GetCatalogCollectionInfoDocument,
                  variables: { catalogCollectionId: objectId },
                },
              ]
            : []),
          ...(objectType === CatalogObjectType.AnswerCollection
            ? [GetAnswerCollectionsInfoDocument]
            : []),
        ],
      })

      if (typeof res.data?.changePermissionLevel) {
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
    onPermissionLevelChange,
    permissionChanging: permissionLevelChanging,
  }
}

export default usePermissionLevelChange
