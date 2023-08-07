import { useMutation } from '@apollo/client'
import { CancelSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface CancelSessionModalProps {
  sessionId: string
  title: string
  isDeletionModalOpen: boolean
  setIsDeletionModalOpen: (value: boolean) => void
}

function CancelSessionModal({
  sessionId,
  title,
  isDeletionModalOpen,
  setIsDeletionModalOpen,
}: CancelSessionModalProps) {
  const [cancelSession] = useMutation(CancelSessionDocument, {
    variables: { id: sessionId },
  })
  const router = useRouter()
  const t = useTranslations()

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await cancelSession()
            router.push('/sessions')
          }}
          className={{ root: 'bg-red-600 font-bold text-white' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setIsDeletionModalOpen(false)}>
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setIsDeletionModalOpen(false)}
      open={isDeletionModalOpen}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>{t('manage.cockpit.abortSession')}</H2>
        <div>{t('manage.cockpit.confirmAbortSession')}</div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          {t('manage.cockpit.abortSessionHint')}
        </div>
      </div>
    </Modal>
  )
}

export default CancelSessionModal
