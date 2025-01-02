import { Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function ImportRequestSuccessToast({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  return (
    <Toast
      dismissible
      openExternal={open}
      onCloseExternal={() => setOpen(false)}
      type="success"
    >
      {t('manage.resources.requestImportSuccess')}
    </Toast>
  )
}

export default ImportRequestSuccessToast
