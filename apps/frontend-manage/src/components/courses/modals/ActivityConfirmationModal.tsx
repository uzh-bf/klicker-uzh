import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

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
          loading={submitting}
          disabled={
            confirmationsInitializing ||
            Object.values(confirmations).some((confirmation) => !confirmation)
          }
          onClick={async () => {
            await onSubmit()
            setOpen(false)
          }}
          className={{
            root: twMerge(
              'bg-primary-100 text-white hover:text-white disabled:bg-opacity-50 disabled:hover:cursor-not-allowed',
              confirmationType === 'delete' && 'bg-red-700 hover:bg-red-800'
            ),
          }}
          data={{ cy: 'activity-deletion-modal-confirm' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
          }}
          data={{ cy: 'activity-deletion-modal-cancel' }}
        >
          {t('shared.generic.cancel')}
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
