import { trpc } from '@lib/trpc'
import { Button, H3, Modal, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function AccountDeletionForm() {
  const t = useTranslations()

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const deleteParticipantAccount = trpc.participant.deleteAccount.useMutation()
  const logoutParticipant = trpc.participant.logout.useMutation()
  const deleting =
    deleteParticipantAccount.isLoading || logoutParticipant.isLoading
  const closeDeletionModal = (): void => {
    if (!deleting) {
      setDeleteModalOpen(false)
    }
  }

  return (
    <div className="order-1 flex h-full flex-1 flex-col justify-between space-y-4 rounded md:order-2 md:bg-slate-50 md:p-4">
      <div className="flex-initial space-y-2">
        <H3 className={{ root: 'mb-1.5 border-b' }}>
          {t('pwa.profile.deleteProfile')}
        </H3>

        {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true' ? (
          t('pwa.assessment.accountDeletionMessage')
        ) : (
          <>
            <div>{t('pwa.profile.deleteProfileDescription')}</div>
            <Button
              destructive
              onClick={(): void => setDeleteModalOpen(true)}
              className={{ root: 'w-full md:w-max' }}
              data={{ cy: 'confirm-delete-account' }}
            >
              <Button.Label>{t('shared.generic.delete')}</Button.Label>
            </Button>

            <Modal
              hideCloseButton
              title={t('pwa.profile.deleteProfile')}
              open={deleteModalOpen}
              onClose={closeDeletionModal}
              primaryLabel={t('shared.generic.confirm')}
              primaryButtonStyle="destructive"
              primaryLoading={deleting}
              primaryDisabled={deleting}
              onPrimaryAction={async () => {
                try {
                  const deleted = await deleteParticipantAccount.mutateAsync()

                  if (!deleted) {
                    toast({
                      type: 'error',
                      message: t('shared.generic.systemError'),
                      options: { duration: 5000 },
                    })
                    return
                  }

                  await logoutParticipant
                    .mutateAsync()
                    .catch((error) => console.error(error))
                  sessionStorage.removeItem('participant_token')
                  window?.location.reload()
                } catch (error) {
                  console.error(error)
                  toast({
                    type: 'error',
                    message: t('shared.generic.systemError'),
                    options: { duration: 5000 },
                  })
                }
              }}
              dataPrimaryAction={{ cy: 'delete-account-command' }}
              secondaryLabel={t('shared.generic.cancel')}
              onSecondaryAction={closeDeletionModal}
              dataSecondaryAction={{ cy: 'cancel-delete-account' }}
              className={{ content: 'max-w-md' }}
            >
              <div className="mt-2 text-sm">
                {t('pwa.profile.deleteProfileConfirmation')}
              </div>
            </Modal>
          </>
        )}
      </div>
    </div>
  )
}

export default AccountDeletionForm
