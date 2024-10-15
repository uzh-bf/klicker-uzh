import { useMutation } from '@apollo/client'
import {
  DeleteParticipantAccountDocument,
  LogoutParticipantDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Modal, Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

function AccountDeletionForm() {
  const t = useTranslations()
  const [deleteParticipantAccount] = useMutation(
    DeleteParticipantAccountDocument
  )
  const [logoutParticipant] = useMutation(LogoutParticipantDocument)

  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/profile')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    const redirectTo = urlParams?.get('redirect_to')
    if (redirectTo) {
      setDecodedRedirectPath(decodeURIComponent(redirectTo))
    }
  }, [])

  return (
    <div className="order-1 flex h-full flex-1 flex-col justify-between space-y-4 rounded md:order-2 md:bg-slate-50 md:p-4">
      <div className="flex-initial space-y-2">
        <H3 className={{ root: 'mb-0 border-b' }}>
          {t('pwa.profile.deleteProfile')}
        </H3>
        <Prose className={{ root: '' }}>
          {t('pwa.profile.deleteProfileDescription')}
        </Prose>
        <Button
          onClick={(): void => setDeleteModalOpen(true)}
          data={{ cy: 'confirm-delete-account' }}
          className={{
            root: 'border-red-700 text-red-600 hover:border-red-700 hover:bg-red-600 hover:text-white',
          }}
        >
          {t('shared.generic.delete')}
        </Button>

        <Modal
          title={t('pwa.profile.deleteProfile')}
          open={deleteModalOpen}
          onClose={(): void => setDeleteModalOpen(false)}
          hideCloseButton={true}
          className={{ content: 'max-w-md' }}
          onPrimaryAction={
            <Button
              className={{
                root: 'border-red-700 bg-red-600 text-white',
              }}
              onClick={async () => {
                await deleteParticipantAccount()
                try {
                  await logoutParticipant()
                } catch (e) {}
                window?.location.reload()
              }}
              data={{ cy: 'delete-account-command' }}
            >
              {t('shared.generic.confirm')}
            </Button>
          }
          onSecondaryAction={
            <Button
              onClick={() => setDeleteModalOpen(false)}
              data={{ cy: 'cancel-delete-account' }}
            >
              {t('shared.generic.cancel')}
            </Button>
          }
        >
          {t('pwa.profile.deleteProfileConfirmation')}
        </Modal>
      </div>
    </div>
  )
}

export default AccountDeletionForm
