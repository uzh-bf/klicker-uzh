import { ToastLegacy } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function LeaveUserGroupSuccessToast({
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
      type="success"
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      className={{ root: 'max-w-[30rem]' }}
      duration={3000}
    >
      {t('manage.userGroups.leaveGroupSuccess')}
    </ToastLegacy>
  )
}

export default LeaveUserGroupSuccessToast
