import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc } from '../../lib/trpc'

function useDemoteGroupAdminToMember() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const demoteGroupAdminToMember =
    trpc.sharing.demoteGroupAdminToMember.useMutation()
  const [demotionPending, setDemotionPending] = useState(false)
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
    if (demotionPending) return

    setDemotionPending(true)

    try {
      const result = await demoteGroupAdminToMember.mutateAsync({
        groupId,
        adminId,
      })
      if (result.demoted) {
        await utils.sharing.userGroups.invalidate()
      } else {
        onErrorToast()
      }
    } catch (e) {
      console.error(e)
      onErrorToast()
    } finally {
      setDemotionPending(false)
    }
  }

  return {
    onDemotion,
    demoting: demoteGroupAdminToMember.isLoading || demotionPending,
  }
}

export default useDemoteGroupAdminToMember
