import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

interface LiveSessionDeletionModalProps {
  title: string
  deleteSession: () => Promise<any>
  open: boolean
  setOpen: (value: boolean) => void
}

function LiveSessionDeletionModal({
  title,
  deleteSession,
  open,
  setOpen,
}: LiveSessionDeletionModalProps) {
  const t = useTranslations()
  // TODO: implement more efficiently with working update instead of expensive refetch

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
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setOpen(false)}>
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>{t('manage.sessions.deleteLiveSession')}</H2>
        <div>{t('manage.sessions.confirmLiveSessionDeletion')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('manage.sessions.liveSessionDeletionHint')}
        </div>
      </div>
    </Modal>
  )
}

export default LiveSessionDeletionModal
