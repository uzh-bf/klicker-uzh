import { useMutation } from '@apollo/client'
import { DeleteParticipantAccountDocument } from '@klicker-uzh/graphql/dist/ops'
import { trpc } from '@lib/trpc'
import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function AccountDeletionForm() {
  const t = useTranslations()

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteParticipantAccount, { loading: deletingAccount }] = useMutation(
    DeleteParticipantAccountDocument
  )
  const logoutParticipant = trpc.participant.logout.useMutation()

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
              onClose={(): void => setDeleteModalOpen(false)}
              primaryLabel={t('shared.generic.confirm')}
              primaryButtonStyle="destructive"
              primaryLoading={deletingAccount || logoutParticipant.isPending}
              onPrimaryAction={async () => {
                await deleteParticipantAccount()
                try {
                  await logoutParticipant.mutateAsync()
                  sessionStorage.removeItem('participant_token')
                } catch (e) {}
                window?.location.reload()
              }}
              dataPrimaryAction={{ cy: 'delete-account-command' }}
              secondaryLabel={t('shared.generic.cancel')}
              onSecondaryAction={() => setDeleteModalOpen(false)}
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
