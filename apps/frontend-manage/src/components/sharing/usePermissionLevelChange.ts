import { useMutation } from '@apollo/client'
import {
  CatalogObjectType,
  ChangeAnswerCollectionPermissionLevelDocument,
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
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
  const [
    changeAnswerCollectionPermissionLevel,
    { loading: answerCollectionPermissionChanging },
  ] = useMutation(ChangeAnswerCollectionPermissionLevelDocument)

  if (objectType === CatalogObjectType.CatalogCollection) {
    // TODO: implement
    return {
      onPermissionLevelChange: async () => {
        console.error('Unsupported object type', objectType)
        return false
      },
      permissionChanging: false,
    }
  } else if (objectType === CatalogObjectType.AnswerCollection) {
    const onAnswerCollectionPermissionChange = async ({
      permissionId,
      newPermissionLevel,
    }: {
      permissionId: number
      newPermissionLevel: PermissionLevel
    }) => {
      try {
        const res = await changeAnswerCollectionPermissionLevel({
          variables: {
            collectionId: objectId as number,
            permissionId,
            permissionLevel: newPermissionLevel,
          },
          update: (cache, { data }) => {
            if (!data?.changeAnswerCollectionPermissionLevel) return

            const prevPermissions = cache.readQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId: objectId as number,
              },
            })

            if (!prevPermissions?.getAnswerCollectionPermissions) {
              return
            }

            const modifiedPermissionId =
              data.changeAnswerCollectionPermissionLevel!.permissionId
            const newPermissionLevel =
              data.changeAnswerCollectionPermissionLevel!.permissionLevel
            cache.writeQuery({
              query: GetAnswerCollectionPermissionsDocument,
              variables: {
                collectionId: objectId as number,
              },
              data: {
                getAnswerCollectionPermissions:
                  prevPermissions.getAnswerCollectionPermissions.map(
                    (permission) =>
                      permission.permissionId === modifiedPermissionId
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
            GetAnswerCollectionsInfoDocument,
            GetCatalogSharingRequestsDocument,
            {
              query: GetCatalogObjectsDocument,
              variables: { catalogCollectionId },
            },
          ],
        })

        if (
          typeof res.data?.changeAnswerCollectionPermissionLevel
            ?.permissionId !== 'undefined'
        ) {
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
      onPermissionLevelChange: onAnswerCollectionPermissionChange,
      permissionChanging: answerCollectionPermissionChanging,
    }
  }

  return {
    onPermissionLevelChange: async () => {
      console.error('Unsupported object type', objectType)
      return false
    },
    permissionChanging: false,
  }
}

export default usePermissionLevelChange
