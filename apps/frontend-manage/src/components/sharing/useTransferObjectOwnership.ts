import type { ObjectType } from '@lib/constants/sharingEnums'
import { trpc, type RouterInputs } from '../../lib/trpc'

type ObjectPermissionsInput = RouterInputs['sharing']['objectPermissions']
type TransferObjectOwnershipInput =
  RouterInputs['sharing']['transferObjectOwnership']

function useTransferObjectOwnership({
  objectType,
  objectId,
}: {
  objectType: ObjectType
  objectId: string | number
}): {
  onTransfer: (shortnameOrEmail: string) => Promise<boolean>
  transferring: boolean
} {
  const utils = trpc.useUtils()
  const objectPermissionsInput: ObjectPermissionsInput = {
    objectId: String(objectId),
    objectType: objectType as unknown as ObjectPermissionsInput['objectType'],
  }
  const transferObjectOwnership =
    trpc.sharing.transferObjectOwnership.useMutation({
      onSuccess: async (data) => {
        if (!data.permission) return

        await Promise.all([
          utils.sharing.objectPermissions.invalidate(objectPermissionsInput),
          utils.sharing.derivedObjectPermissions.invalidate(
            objectPermissionsInput
          ),
        ])
      },
    })

  const onTransfer = async (shortnameOrEmail: string) => {
    try {
      const input: TransferObjectOwnershipInput = {
        ...objectPermissionsInput,
        objectType:
          objectType as unknown as TransferObjectOwnershipInput['objectType'],
        shortnameOrEmail,
      }
      const res = await transferObjectOwnership.mutateAsync(input)

      if (res.permission) {
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
    onTransfer,
    transferring: transferObjectOwnership.isLoading,
  }
}

export default useTransferObjectOwnership
