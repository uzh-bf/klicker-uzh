import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetObjectPermissionsDocument,
  PermissionLevel,
  ShareObjectDocument,
  SharingObjectType,
} from '@klicker-uzh/graphql/dist/ops'

// function to revoke the permission for a certain object
function useObjectSharing({
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
  onShareObject: ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
  }) => Promise<boolean>
  objectSharing: boolean
} {
  const [shareObject, { loading: sharingObject }] =
    useMutation(ShareObjectDocument)

  const onShareObject = async ({
    shortnameOrEmail,
    userGroupId,
    permissionLevel,
  }: {
    shortnameOrEmail?: string
    userGroupId?: number
    permissionLevel: PermissionLevel
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
          permissionLevel: permissionLevel,
        },
        update: (cache, { data }) => {
          if (!data?.shareObject) return

          const prevPermissions = cache.readQuery({
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          })

          if (!prevPermissions?.getObjectPermissions) {
            return
          }

          // replace the permission that was just added (if it already exists) and add it otherwise
          const newPermissions = prevPermissions.getObjectPermissions.filter(
            (permission) =>
              permission.permissionId !== data.shareObject!.permissionId
          )
          newPermissions.push(data.shareObject)

          cache.writeQuery({
            query: GetObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
            data: {
              getObjectPermissions: newPermissions,
            },
          })
        },
        refetchQueries: [
          GetCatalogSharingRequestsDocument,
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

      if (typeof res?.data?.shareObject?.permissionId !== 'undefined') {
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
