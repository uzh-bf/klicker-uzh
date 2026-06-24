import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc } from '../../lib/trpc'
import type { UserGroup } from './types'

function useTransferGroupOwnership() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const transferGroupOwnership =
    trpc.sharing.transferGroupOwnership.useMutation()
  const [ownershipTransferPending, setOwnershipTransferPending] =
    useState(false)
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
    if (ownershipTransferPending) return

    setOwnershipTransferPending(true)

    try {
      const result = await transferGroupOwnership.mutateAsync({
        id: group.id,
        newOwnerId,
      })
      if (result.transferred) {
        await utils.sharing.userGroups.invalidate()
      } else {
        onErrorToast()
      }
    } catch (error) {
      console.error(error)
      onErrorToast()
    } finally {
      setOwnershipTransferPending(false)
    }
  }

  return {
    onOwnershipTransfer,
    transferringOwnership:
      transferGroupOwnership.isLoading || ownershipTransferPending,
  }
}

export default useTransferGroupOwnership
