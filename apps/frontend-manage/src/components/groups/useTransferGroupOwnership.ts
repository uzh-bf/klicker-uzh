import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'
import type { UserGroup } from './types'

function useTransferGroupOwnership() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const transferGroupOwnership =
    trpc.sharing.transferGroupOwnership.useMutation()
  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })

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
      if (result.transferred) {
        void utils.sharing.userGroups.invalidate().catch(console.error)
      } else {
        onErrorToast()
      }
    } catch (error) {
      console.error(error)
      onErrorToast()
    }
  }

  return {
    onOwnershipTransfer,
    transferringOwnership: transferGroupOwnership.isLoading,
  }
}

export default useTransferGroupOwnership
