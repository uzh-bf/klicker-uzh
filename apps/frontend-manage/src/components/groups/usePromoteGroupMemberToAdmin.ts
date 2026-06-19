import { trpc } from '../../lib/trpc'

function usePromoteGroupMemberToAdmin() {
  const utils = trpc.useUtils()
  const promoteGroupMemberToAdmin =
    trpc.sharing.promoteGroupMemberToAdmin.useMutation()

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
      if (result.promoted) await utils.sharing.userGroups.invalidate()
    } catch (e) {
      console.error(e)
    }
  }

  return { onPromotion, promoting: promoteGroupMemberToAdmin.isPending }
}

export default usePromoteGroupMemberToAdmin
