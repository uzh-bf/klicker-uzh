import { Modal, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

interface ActivityConfirmationModalProps {
  onClose: () => void
  title: string
  message: string | React.ReactNode
  loading?: boolean
  onSubmit: () => Promise<any>
  submitting: boolean
  confirmations: Record<string, boolean>
  confirmationsInitializing: boolean
  confirmationType?: 'confirm' | 'delete'
  children: React.ReactNode
}

function ActivityConfirmationModal({
  onClose,
  title,
  message,
  loading = false,
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
  const handleClose = () => {
    if (!submitting) {
      onClose()
    }
  }

  return (
    <Modal
      open
      loading={loading}
      onClose={handleClose}
      className={{ content: 'w-full! max-w-200' }}
      title={title}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={submitting}
      primaryDisabled={disabled || submitting}
      primaryButtonStyle={
        confirmationType === 'delete'
          ? 'destructive'
          : confirmationType === 'confirm'
            ? 'primary'
            : undefined
      }
      onPrimaryAction={async () => {
        try {
          await onSubmit()
          onClose()
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        }
      }}
      dataPrimaryAction={{ cy: 'confirmation-modal-confirm' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={handleClose}
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
