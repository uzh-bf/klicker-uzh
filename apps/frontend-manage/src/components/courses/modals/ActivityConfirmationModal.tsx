import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

interface ActivityConfirmationModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  title: string
  message: string | React.ReactNode
  onSubmit: () => Promise<any>
  submitting: boolean
  confirmations: Record<string, boolean>
  confirmationsInitializing: boolean
  confirmationType?: 'confirm' | 'delete'
  children: React.ReactNode
}

function ActivityConfirmationModal({
  open,
  setOpen,
  title,
  message,
  onSubmit,
  submitting,
  confirmations,
  confirmationsInitializing,
  confirmationType = 'confirm',
  children,
}: ActivityConfirmationModalProps) {
  const t = useTranslations()
  const disabled =
    confirmationsInitializing ||
    Object.values(confirmations).some((confirmation) => !confirmation)

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
      }}
      className={{ content: '!w-full max-w-[50rem]' }}
      title={title}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={submitting}
      primaryDisabled={disabled}
      primaryButtonStyle={
        confirmationType === 'delete'
          ? 'destructive'
          : confirmationType === 'confirm'
            ? 'primary'
            : undefined
      }
      onPrimaryAction={async () => {
        await onSubmit()
        setOpen(false)
      }}
      dataPrimaryAction={{ cy: 'confirmation-modal-confirm' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={() => {
        setOpen(false)
      }}
      dataSecondaryAction={{ cy: 'confirmation-modal-cancel' }}
      dataCloseButton={{ cy: 'confirmation-modal-close' }}
    >
      <UserNotification type="warning" className={{ root: 'mb-3 text-base' }}>
        {message}
      </UserNotification>
      {children}
    </Modal>
  )
}

export default ActivityConfirmationModal
