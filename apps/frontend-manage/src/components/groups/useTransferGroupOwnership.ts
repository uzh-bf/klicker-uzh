import { trpc } from '../../lib/trpc'
import type { UserGroup } from './types'

function useTransferGroupOwnership() {
  const utils = trpc.useUtils()
  const transferGroupOwnership =
    trpc.sharing.transferGroupOwnership.useMutation()

  const onOwnershipTransfer = async ({
    group,
    newOwnerId,
  }: {
    group: UserGroup
    newOwnerId: string
  }) => {
    try {
      const result = await transferGroupOwnership.mutateAsync({
        id: group.id,
        newOwnerId,
      })
      if (result.transferred) await utils.sharing.userGroups.invalidate()
    } catch (error) {
      console.error(error)
    }
  }

  return {
    onOwnershipTransfer,
    transferringOwnership: transferGroupOwnership.isLoading,
  }
}

export default useTransferGroupOwnership
