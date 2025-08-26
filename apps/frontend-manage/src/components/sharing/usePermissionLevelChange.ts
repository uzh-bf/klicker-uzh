import { useMutation } from '@apollo/client'
import {
  ChangePermissionLevelDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  ObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'

// function to change the permission level for a certain object
function usePermissionLevelChange({
  objectId,
  objectType,
  catalogCollectionId,
}: {
  objectId: string | number
  objectType: ObjectType
  catalogCollectionId?: string
}): {
  onPermissionLevelChange: ({
    permissionId,
    newPermissionLevel,
    newPropagation,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
    newPropagation: boolean
  }) => Promise<boolean>
  permissionChanging: boolean
} {
  const [changePermissionLevel, { loading: permissionLevelChanging }] =
    useMutation(ChangePermissionLevelDocument)

  const onPermissionLevelChange = async ({
    permissionId,
    newPermissionLevel,
    newPropagation,
  }: {
    permissionId: number
    newPermissionLevel: PermissionLevel
    newPropagation: boolean
  }) => {
    try {
      const res = await changePermissionLevel({
        variables: {
          objectId: String(objectId),
          objectType,
          permissionId,
          permissionLevel: newPermissionLevel,
          propagation: newPropagation,
        },
        update: (cache, { data }) => {
          // verify that the permission level change was successful
          if (!data?.changePermissionLevel) return

          // update the permission in the list with the updated permission level
          cache.updateQuery(
            {
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
            },
            (qData) => {
              if (!qData?.getObjectPermissions) return qData

              return {
                ...qData,
                getObjectPermissions: qData.getObjectPermissions.map(
                  (permission) =>
                    permission.permissionId === permissionId
                      ? {
                          ...permission,
                          permissionLevel: newPermissionLevel,
                          propagation: newPropagation,
                        }
                      : permission
                ),
              }
            }
          )
        },
        // TODO: evaluate if more evolved and type-dependent cache updates are helpful here performance-wise
        refetchQueries: [
          {
            query: GetCatalogObjectsDocument,
            variables: { catalogCollectionId },
          },
          { query: GetCatalogSharingRequestsDocument },
          ...(objectType === ObjectType.CatalogCollection
            ? [
                {
                  query: GetCatalogCollectionInfoDocument,
                  variables: { catalogCollectionId: objectId },
                },
              ]
            : []),
          ...(objectType === ObjectType.AnswerCollection
            ? [{ query: GetAnswerCollectionsInfoDocument }]
            : []),
        ],
      })

      if (res.data?.changePermissionLevel) {
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
