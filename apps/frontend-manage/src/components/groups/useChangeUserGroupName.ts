import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { trpc } from '../../lib/trpc'

function useChangeUserGroupName() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const changeUserGroupName = trpc.sharing.changeUserGroupName.useMutation()
  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
      options: { duration: 5000 },
    })

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
        await utils.sharing.userGroups.invalidate().catch(console.error)
        setTitleEditMode(false)
      } else {
        onErrorToast()
      }
    } catch (error) {
      console.error(error)
      onErrorToast()
    }
  }

  return { onNameChange, nameChanging: changeUserGroupName.isLoading }
}

export default useChangeUserGroupName
