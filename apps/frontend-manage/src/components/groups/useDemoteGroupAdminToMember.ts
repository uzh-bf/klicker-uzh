import { trpc } from '../../lib/trpc'

function useDemoteGroupAdminToMember() {
  const utils = trpc.useUtils()
  const demoteGroupAdminToMember =
    trpc.sharing.demoteGroupAdminToMember.useMutation()

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
      if (result.demoted) await utils.sharing.userGroups.invalidate()
    } catch (e) {
      console.error(e)
    }
  }

  return { onDemotion, demoting: demoteGroupAdminToMember.isPending }
}

export default useDemoteGroupAdminToMember
