import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc } from '../../lib/trpc'

function useRemoveUserFromGroup() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const removeUserFromGroup = trpc.sharing.removeUserFromGroup.useMutation()
  const [removalPending, setRemovalPending] = useState(false)
  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })

  const onRemove = async ({
    groupId,
    userId,
  }: {
    groupId: number
    userId: string
  }) => {
    if (removalPending) return

    setRemovalPending(true)

    try {
      const result = await removeUserFromGroup.mutateAsync({
        groupId,
        userId,
      })
      if (result.removed) {
        await utils.sharing.userGroups.invalidate()
      } else {
        onErrorToast()
      }
    } catch (error) {
      console.error(error)
      onErrorToast()
    } finally {
      setRemovalPending(false)
    }
  }

  return {
    onRemove,
    removing: removeUserFromGroup.isLoading || removalPending,
  }
}

export default useRemoveUserFromGroup
