import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'

function usePromoteGroupMemberToAdmin() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const promoteGroupMemberToAdmin =
    trpc.sharing.promoteGroupMemberToAdmin.useMutation()
  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })

  const onPromotion = async ({
    groupId,
    memberId,
  }: {
    groupId: number
    memberId: string
  }) => {
    try {
      const result = await promoteGroupMemberToAdmin.mutateAsync({
        groupId,
        memberId,
      })
      if (result.promoted) {
        await utils.sharing.userGroups.invalidate().catch(console.error)
      } else {
        onErrorToast()
      }
    } catch (e) {
      console.error(e)
      onErrorToast()
    }
  }

  return { onPromotion, promoting: promoteGroupMemberToAdmin.isLoading }
}

export default usePromoteGroupMemberToAdmin
