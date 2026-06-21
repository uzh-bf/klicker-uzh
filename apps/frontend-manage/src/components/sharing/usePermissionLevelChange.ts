import {
  ObjectType as SharingObjectType,
  type ObjectType,
  type PermissionLevel,
} from '@lib/constants/sharingEnums'
import { trpc, type RouterInputs } from '../../lib/trpc'

type ObjectPermissionsInput = RouterInputs['sharing']['objectPermissions']
type ChangePermissionLevelInput =
  RouterInputs['sharing']['changePermissionLevel']

// function to change the permission level for a certain object
function usePermissionLevelChange({
  objectId,
  objectType,
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
  const utils = trpc.useUtils()
  const objectPermissionsInput: ObjectPermissionsInput = {
    objectId: String(objectId),
    objectType: objectType as unknown as ObjectPermissionsInput['objectType'],
  }

  const invalidateAnswerCollectionList = () => {
    if (objectType === SharingObjectType.AnswerCollection) {
      void utils.resources.answerCollectionsInfo
        .invalidate()
        .catch(console.error)
    }
  }

  const changePermissionLevel = trpc.sharing.changePermissionLevel.useMutation({
    onSuccess: (data, variables) => {
      if (!data.changed) return

      utils.sharing.objectPermissions.setData(
        objectPermissionsInput,
        (queryData) => {
          if (!queryData?.objectPermissions) return queryData

          return {
            objectPermissions: {
              ...queryData.objectPermissions,
              permissions: queryData.objectPermissions.permissions.map(
                (permission) =>
                  permission.permissionId === variables.permissionId
                    ? {
                        ...permission,
                        permissionLevel: variables.permissionLevel,
                        propagation: variables.propagation,
                      }
                    : permission
              ),
            },
          }
        }
      )

      void utils.sharing.derivedObjectPermissions
        .invalidate(objectPermissionsInput)
        .catch(console.error)
    },
  })

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
      const input: ChangePermissionLevelInput = {
        ...objectPermissionsInput,
        objectType:
          objectType as unknown as ChangePermissionLevelInput['objectType'],
        permissionId,
        permissionLevel:
          newPermissionLevel as unknown as ChangePermissionLevelInput['permissionLevel'],
        propagation: newPropagation,
      }
      const res = await changePermissionLevel.mutateAsync(input)

      if (res.changed) {
        invalidateAnswerCollectionList()
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
    permissionChanging: changePermissionLevel.isLoading,
  }
}

export default usePermissionLevelChange
