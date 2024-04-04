import { useMutation } from '@apollo/client'
import {
  CancelSessionDocument,
  GetUserRunningSessionsDocument,
  GetUserSessionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface CancelSessionModalProps {
  sessionId: string
  title: string
  isCancellationModalOpen: boolean
  setIsCancellationModalOpen: (value: boolean) => void
}

function CancelSessionModal({
  sessionId,
  title,
  isCancellationModalOpen,
  setIsCancellationModalOpen,
}: CancelSessionModalProps) {
  const [cancelSession] = useMutation(CancelSessionDocument, {
    variables: { id: sessionId },
    refetchQueries: [
      {
        query: GetUserRunningSessionsDocument,
      },
      {
        query: GetUserSessionsDocument,
      },
    ],
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
          data={{ cy: 'confirm-cancel-session' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setIsCancellationModalOpen(false)}
          data={{ cy: 'abort-cancel-session' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setIsCancellationModalOpen(false)}
      open={isCancellationModalOpen}
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
