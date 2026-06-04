import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs } from '../../lib/trpc'

type ObjectPermissionsInput = RouterInputs['sharing']['objectPermissions']
type RevokeObjectAccessInput = RouterInputs['sharing']['revokeObjectAccess']

// function to revoke the permission for a certain object
function usePermissionRevocation({
  objectId,
  objectType,
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
  const utils = trpc.useUtils()
  const objectPermissionsInput: ObjectPermissionsInput = {
    objectId: String(objectId),
    objectType: objectType as unknown as ObjectPermissionsInput['objectType'],
  }
  const revokeObjectAccess = trpc.sharing.revokeObjectAccess.useMutation({
    onSuccess: (data) => {
      if (data.revokedPermissionId == null) return

      utils.sharing.objectPermissions.setData(
        objectPermissionsInput,
        (queryData) => {
          if (!queryData?.objectPermissions) return queryData

          return {
            objectPermissions: {
              ...queryData.objectPermissions,
              permissions: queryData.objectPermissions.permissions.filter(
                (permission) =>
                  permission.permissionId !== data.revokedPermissionId
              ),
            },
          }
        }
      )

      void utils.sharing.derivedObjectPermissions.invalidate(
        objectPermissionsInput
      )
    },
  })

  const onPermissionRevocation = async ({
    permissionId,
    isOwn,
  }: {
    permissionId: number
    isOwn: boolean
  }) => {
    try {
      const input: RevokeObjectAccessInput = {
        ...objectPermissionsInput,
        objectType:
          objectType as unknown as RevokeObjectAccessInput['objectType'],
        permissionId,
      }
      const res = await revokeObjectAccess.mutateAsync(input)

      if (res.revokedPermissionId != null) {
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
    permissionRevoking: revokeObjectAccess.isLoading,
  }
}

export default usePermissionRevocation
