import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

interface ActivityConfirmationModalProps {
  onClose: () => void
  title: string
  message: string | React.ReactNode
  loading?: boolean
  onSubmit: () => Promise<boolean | void>
  submitting: boolean
  confirmations: Record<string, boolean>
  confirmationsInitializing: boolean
  primaryDisabled?: boolean
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
  primaryDisabled,
  confirmationType = 'confirm',
  children,
}: ActivityConfirmationModalProps) {
  const t = useTranslations()
  const disabled =
    primaryDisabled ||
    confirmationsInitializing ||
    Object.values(confirmations).some((confirmation) => !confirmation)

  return (
    <Modal
      open
      loading={loading}
      onClose={onClose}
      className={{ content: 'w-full! max-w-200' }}
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
        const success = await onSubmit()
        if (success !== false) onClose()
      }}
      dataPrimaryAction={{ cy: 'confirmation-modal-confirm' }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
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
