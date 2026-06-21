import { Dispatch, SetStateAction } from 'react'
import { trpc } from '../../lib/trpc'

function useChangeUserGroupName() {
  const utils = trpc.useUtils()
  const changeUserGroupName = trpc.sharing.changeUserGroupName.useMutation()

  const onNameChange = async ({
    groupId,
    newName,
    setTitleEditMode,
  }: {
    groupId: number
    newName: string
    setTitleEditMode: Dispatch<SetStateAction<boolean>>
  }) => {
    try {
      const result = await changeUserGroupName.mutateAsync({
        id: groupId,
        name: newName,
      })
      if (result.changed) {
        await utils.sharing.userGroups.invalidate()
        setTitleEditMode(false)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return { onNameChange, nameChanging: changeUserGroupName.isLoading }
}

export default useChangeUserGroupName
