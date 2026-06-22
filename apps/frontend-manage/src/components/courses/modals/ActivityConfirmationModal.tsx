import { Modal, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'

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
  const [submitRefreshing, setSubmitRefreshing] = useState(false)
  const submitPending = submitting || submitRefreshing
  const disabled =
    confirmationsInitializing ||
    Object.values(confirmations).some((confirmation) => !confirmation)
  const handleClose = () => {
    if (!submitPending) {
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
      primaryLoading={submitPending}
      primaryDisabled={disabled || submitPending}
      primaryButtonStyle={
        confirmationType === 'delete'
          ? 'destructive'
          : confirmationType === 'confirm'
            ? 'primary'
            : undefined
      }
      onPrimaryAction={async () => {
        setSubmitRefreshing(true)
        try {
          await onSubmit()
          setSubmitRefreshing(false)
          onClose()
        } catch (error) {
          setSubmitRefreshing(false)
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
