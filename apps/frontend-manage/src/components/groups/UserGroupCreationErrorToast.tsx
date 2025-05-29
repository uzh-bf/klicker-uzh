import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function UserGroupCreationErrorToast({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const t = useTranslations()

  return (
    <ToastLegacy
      dismissible
      type="error"
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      className={{ root: 'max-w-[30rem]' }}
      duration={10000}
      data={{ cy: 'user-group-creation-error-toast' }}
    >
      {t('manage.userGroups.creationErrorMessage')}
    </ToastLegacy>
  )
}

export default UserGroupCreationErrorToast
