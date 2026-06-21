import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'

function useRemoveUserFromGroup() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const removeUserFromGroup = trpc.sharing.removeUserFromGroup.useMutation()
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
    try {
      const result = await removeUserFromGroup.mutateAsync({
        groupId,
        userId,
      })
      if (result.removed) {
        void utils.sharing.userGroups.invalidate().catch(console.error)
      } else {
        onErrorToast()
      }
    } catch (error) {
      console.error(error)
      onErrorToast()
    }
  }

  return { onRemove, removing: removeUserFromGroup.isLoading }
}

export default useRemoveUserFromGroup
