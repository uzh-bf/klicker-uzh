import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function DeleteUserGroupSuccessToast({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      type="success"
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      className={{ root: 'max-w-[30rem]' }}
      duration={3000}
    >
      {t('manage.userGroups.deleteGroupSuccess')}
    </Toast>
  )
}

export default DeleteUserGroupSuccessToast
