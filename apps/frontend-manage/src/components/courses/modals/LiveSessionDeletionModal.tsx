import { Button, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface LiveSessionDeletionModalProps {
  title: string
  message: string
  deleteSession: () => Promise<any>
  open: boolean
  setOpen: (value: boolean) => void
}

function LiveSessionDeletionModal({
  title,
  message,
  deleteSession,
  open,
  setOpen,
}: LiveSessionDeletionModalProps) {
  const t = useTranslations()

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteSession()
            setOpen(false)
          }}
          className={{
            root: twMerge('bg-red-600 font-bold text-white'),
          }}
          data={{ cy: 'confirm-delete-live-quiz' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'cancel-delete-live-quiz' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      title={t('manage.sessions.deleteLiveQuiz')}
      className={{
        content: 'w-[40rem] min-h-max h-max self-center pt-0',
        title: 'text-xl',
      }}
    >
      <div>
        <div>{t('manage.sessions.confirmLiveQuizDeletion')}</div>
        <H3
          className={{
            root: 'p-2 mt-1 border border-solid rounded border-uzh-grey-40',
          }}
        >
          {title}
        </H3>
        <div className="mt-4 text-sm italic">{message}</div>
      </div>
    </Modal>
  )
}

export default LiveSessionDeletionModal
