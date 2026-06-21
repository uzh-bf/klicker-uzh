import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../lib/trpc'

function useDemoteGroupAdminToMember() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const demoteGroupAdminToMember =
    trpc.sharing.demoteGroupAdminToMember.useMutation()
  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })

  const onDemotion = async ({
    groupId,
    adminId,
  }: {
    groupId: number
    adminId: string
  }) => {
    try {
      const result = await demoteGroupAdminToMember.mutateAsync({
        groupId,
        adminId,
      })
      if (result.demoted) {
        void utils.sharing.userGroups.invalidate().catch(console.error)
      } else {
        onErrorToast()
      }
    } catch (e) {
      console.error(e)
      onErrorToast()
    }
  }

  return { onDemotion, demoting: demoteGroupAdminToMember.isLoading }
}

export default useDemoteGroupAdminToMember
