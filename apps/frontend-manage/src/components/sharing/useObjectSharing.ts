import type { ObjectType, PermissionLevel } from '@klicker-uzh/graphql/dist/ops'
import { trpc, type RouterInputs } from '../../lib/trpc'

type ObjectPermissionsInput = RouterInputs['sharing']['objectPermissions']
type ShareObjectInput = RouterInputs['sharing']['shareObject']

// function to revoke the permission for a certain object
function useObjectSharing({
  objectId,
  objectType,
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
  const utils = trpc.useUtils()
  const objectPermissionsInput: ObjectPermissionsInput = {
    objectId: String(objectId),
    objectType: objectType as unknown as ObjectPermissionsInput['objectType'],
  }
  const shareObject = trpc.sharing.shareObject.useMutation({
    onSuccess: (data) => {
      if (!data.permission) return

      utils.sharing.objectPermissions.setData(
        objectPermissionsInput,
        (queryData) => {
          if (!queryData?.objectPermissions) return queryData

          const existingPermission = queryData.objectPermissions.permissions
            .map((permission) =>
              permission.permissionId === data.permission!.permissionId
                ? data.permission!
                : permission
            )
            .filter((permission) => permission.permissionId !== -1)
          const permissionExists = existingPermission.some(
            (permission) =>
              permission.permissionId === data.permission!.permissionId
          )

          return {
            objectPermissions: {
              ...queryData.objectPermissions,
              permissions: permissionExists
                ? existingPermission
                : [...existingPermission, data.permission!],
            },
          }
        }
      )

      void utils.sharing.derivedObjectPermissions.invalidate(
        objectPermissionsInput
      )
    },
  })

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
      const input: ShareObjectInput = {
        ...objectPermissionsInput,
        objectType: objectType as unknown as ShareObjectInput['objectType'],
        shortnameOrEmail:
          typeof shortnameOrEmail !== 'undefined' && shortnameOrEmail !== ''
            ? shortnameOrEmail
            : undefined,
        userGroupId:
          typeof shortnameOrEmail === 'undefined' ? userGroupId : undefined,
        permissionLevel:
          permissionLevel as unknown as ShareObjectInput['permissionLevel'],
        propagation,
      }
      const res = await shareObject.mutateAsync(input)

      if (typeof res?.permission?.permissionId !== 'undefined') {
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
    objectSharing: shareObject.isLoading,
  }
}

export default useObjectSharing
