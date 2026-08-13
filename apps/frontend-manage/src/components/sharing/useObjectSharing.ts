import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  ObjectType,
  type PermissionLevel,
  ShareObjectDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to revoke the permission for a certain object
function useObjectSharing({
  objectId,
  objectType,
  catalogCollectionId,
  onSuccess,
  onError,
}: {
  objectId: string | number
  objectType: ObjectType
  catalogCollectionId?: string
  onSuccess?: () => void
  onError: () => void
}): {
  onShareObject: ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
    propagation,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
    propagation: boolean
  }) => Promise<boolean>
  objectSharing: boolean
} {
  const [shareObject, { loading: sharingObject }] =
    useMutation(ShareObjectDocument)

  const onShareObject = async ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
    propagation,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
    propagation: boolean
  }) => {
    try {
      const res = await shareObject({
        variables: {
          objectId: String(objectId),
          objectType,
          shortnameOrEmail:
            typeof shortnameOrEmail !== 'undefined' && shortnameOrEmail !== ''
              ? shortnameOrEmail
              : undefined,
          userGroupId:
            typeof shortnameOrEmail === 'undefined' ? userGroupId : undefined,
          permissionLevel,
          propagation,
        },
        update: (cache, { data }) => {
          // verify that the sharing action was successful
          if (!data?.shareObject) return

          // update the list of permissions for the given object
          cache.updateQuery(
            {
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
            },
            (qData) => {
              if (!qData?.getObjectPermissions) return qData
              const sharedPermission = data.shareObject!
              return {
                getObjectPermissions: {
                  ...qData.getObjectPermissions,
                  permissions: [
                    ...qData.getObjectPermissions.permissions.filter(
                      (permission) =>
                        permission.permissionId !==
                        sharedPermission.permissionId
                    ),
                    sharedPermission,
                  ],
                },
              }
            }
          )
        },
        // TODO: evaluate if more evolved and type-dependent cache updates are helpful here performance-wise
        refetchQueries: [
          { query: GetCatalogSharingRequestsDocument },
          {
            query: GetCatalogObjectsDocument,
            variables: { catalogCollectionId },
          },
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

      if (typeof res?.data?.shareObject?.permissionId !== 'undefined') {
        onSuccess?.()
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
    onShareObject,
    objectSharing: sharingObject,
  }
}

export default useObjectSharing
