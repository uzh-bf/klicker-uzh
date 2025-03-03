import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ActivityConfirmationModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  title: string
  message: string
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
          data={{ cy: 'activity-confirmation-modal-confirm' }}
        >
          <Button.Label>{t('shared.generic.confirm')}</Button.Label>
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
          }}
          data={{ cy: 'activity-confirmation-modal-cancel' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      }
    >
      <UserNotification
        type="warning"
        message={message}
        className={{ root: 'mb-3' }}
      />
      {children}
    </Modal>
  )
}

export default ActivityConfirmationModal
