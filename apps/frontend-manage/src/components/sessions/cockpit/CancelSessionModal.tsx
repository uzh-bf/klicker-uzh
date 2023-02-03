import { useMutation } from '@apollo/client'
import { CancelSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
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
          Bestätigen
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setIsDeletionModalOpen(false)}>
          Abbrechen
        </Button>
      }
      onClose={(): void => setIsDeletionModalOpen(false)}
      open={isDeletionModalOpen}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>Session abbrechen</H2>
        <div>
          Sind Sie sich sicher, dass Sie die folgende Session abbrechen möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Beim Abbrechen einer Session wird die Session zurückgesetzt, sodass
          sie zu einem späteren Zeitpunkt von Beginn an wieder gestartet werden
          kann. Bitte beachten Sie, dass alle bisherigen Antworten, Feebacks,
          usw. verloren gehen.
        </div>
      </div>
    </Modal>
  )
}

export default CancelSessionModal
