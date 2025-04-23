import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function AddUserGroupErrorToast({
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
      type="error"
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      className={{ root: 'max-w-[30rem]' }}
      duration={7000}
    >
      {t('manage.userGroups.addUserGroupError')}
    </Toast>
  )
}

export default AddUserGroupErrorToast
