import { ObjectType } from '@lib/constants/sharingEnums'
import { trpc, type RouterInputs } from '../../lib/trpc'

type ObjectPermissionsInput = RouterInputs['sharing']['objectPermissions']
type RevokeObjectAccessInput = RouterInputs['sharing']['revokeObjectAccess']

// function to revoke the permission for a certain object
function usePermissionRevocation({
  objectId,
  objectType,
  refetchElements,
  refetchActivities,
}: {
  objectId: string | number
  objectType: ObjectType
  catalogCollectionId?: string
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

  const invalidateAnswerCollectionList = async () => {
    if (objectType === ObjectType.AnswerCollection) {
      await utils.resources.answerCollectionsInfo
        .invalidate()
        .catch(console.error)
    }
  }

  const revokeObjectAccess = trpc.sharing.revokeObjectAccess.useMutation({
    onSuccess: async (data) => {
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

      await utils.sharing.derivedObjectPermissions
        .invalidate(objectPermissionsInput)
        .catch(console.error)
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
        const refreshOwnPermissionLists = async () => {
          // If the current user's own permission was removed, parent lists need
          // to drop the object before the success toast is shown.
          if (!isOwn) return

          if (objectType === ObjectType.Element) {
            await refetchElements?.().catch(console.error)
          }
          if (
            objectType === ObjectType.LiveQuiz ||
            objectType === ObjectType.PracticeQuiz ||
            objectType === ObjectType.MicroLearning ||
            objectType === ObjectType.GroupActivity
          ) {
            await refetchActivities?.().catch(console.error)
          }
        }

        await Promise.all([
          invalidateAnswerCollectionList(),
          refreshOwnPermissionLists(),
        ])

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
    onPermissionRevocation,
    permissionRevoking: revokeObjectAccess.isLoading,
  }
}

export default usePermissionRevocation
