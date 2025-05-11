import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
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
      onPrimaryAction={
        <Button
          primary={confirmationType === 'confirm'}
          destructive={confirmationType === 'delete'}
          loading={submitting}
          disabled={disabled}
          onClick={async () => {
            await onSubmit()
            setOpen(false)
          }}
          data={{ cy: 'confirmation-modal-confirm' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
          }}
          data={{ cy: 'confirmation-modal-cancel' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      }
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
