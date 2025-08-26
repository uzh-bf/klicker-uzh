import { useMutation } from '@apollo/client'
import {
  GetAnswerCollectionsInfoDocument,
  GetCatalogCollectionInfoDocument,
  GetCatalogObjectsDocument,
  GetCatalogSharingRequestsDocument,
  GetDerivedObjectPermissionsDocument,
  GetObjectPermissionsDocument,
  ObjectType,
  RevokeObjectAccessDocument,
} from '@klicker-uzh/graphql/dist/ops'

// function to revoke the permission for a certain object
function usePermissionRevocation({
  objectId,
  objectType,
  catalogCollectionId,
  onError,
  refetchElements,
  refetchActivities,
}: {
  objectId: string | number
  objectType: ObjectType
  catalogCollectionId?: string
  onError: () => void
  refetchElements?: () => Promise<void>
  refetchActivities?: () => Promise<void>
}): {
  onPermissionRevocation: ({
    permissionId,
    isOwn,
  }: {
    permissionId: number
    isOwn: boolean
  }) => Promise<boolean>
  permissionRevoking: boolean
} {
  const [revokeObjectAccess, { loading: revokingObjectAccess }] = useMutation(
    RevokeObjectAccessDocument
  )

  const onPermissionRevocation = async ({
    permissionId,
    isOwn,
  }: {
    permissionId: number
    isOwn: boolean
  }) => {
    try {
      const res = await revokeObjectAccess({
        variables: {
          permissionId,
          objectId: String(objectId),
          objectType,
        },
        update: (cache, { data }) => {
          // verify that the revocation was successful
          if (!data?.revokeObjectAccess) return

          // update the listed permissions to reflect the revocation
          cache.updateQuery(
            {
              query: GetObjectPermissionsDocument,
              variables: { objectId: String(objectId), objectType },
            },
            (qData) => {
              if (!qData?.getObjectPermissions) return qData

              return {
                ...qData,
                getObjectPermissions: qData.getObjectPermissions.filter(
                  (permission) =>
                    permission.permissionId !== data.revokeObjectAccess
                ),
              }
            }
          )
        },
        // TODO: evaluate if more evolved and type-dependent cache updates are helpful here performance-wise
        refetchQueries: [
          { query: GetCatalogSharingRequestsDocument },
          {
            query: GetDerivedObjectPermissionsDocument,
            variables: { objectId: String(objectId), objectType },
          },
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

      if (res.data?.revokeObjectAccess) {
        // if own permission was revoked, refetch elements and activities depending on object type
        if (isOwn && objectType === ObjectType.Element) {
          await refetchElements?.()
        }
        if (
          isOwn &&
          (objectType === ObjectType.LiveQuiz ||
            objectType === ObjectType.PracticeQuiz ||
            objectType === ObjectType.MicroLearning ||
            objectType === ObjectType.GroupActivity)
        ) {
          await refetchActivities?.()
        }

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
