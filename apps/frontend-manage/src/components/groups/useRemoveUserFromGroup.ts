import { trpc } from '../../lib/trpc'

function useRemoveUserFromGroup() {
  const utils = trpc.useUtils()
  const removeUserFromGroup = trpc.sharing.removeUserFromGroup.useMutation()

  const onRemove = async ({
    groupId,
    userId,
  }: {
    groupId: number
    userId: string
  }) => {
    const result = await removeUserFromGroup.mutateAsync({
      groupId,
      userId,
    })
    if (result.removed) await utils.sharing.userGroups.invalidate()
  }

  return { onRemove, removing: removeUserFromGroup.isPending }
}

export default useRemoveUserFromGroup
