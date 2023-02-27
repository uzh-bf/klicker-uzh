import { useMutation } from '@apollo/client'
import {
  DeleteMicroSessionDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface MicroSessionDeletionModalProps {
  sessionId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function MicroSessionDeletionModal({
  sessionId,
  title,
  open,
  setOpen,
}: MicroSessionDeletionModalProps) {
  // TODO: implement more efficiently with working update instead of expensive refetch
  const [deleteMicroSession] = useMutation(DeleteMicroSessionDocument, {
    variables: { id: sessionId },
    refetchQueries: [GetSingleCourseDocument],
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteMicroSession()
            setOpen(false)
          }}
          className={{
            root: twMerge('bg-red-600 font-bold text-white'),
          }}
        >
          Bestätigen
        </Button>
      }
      onSecondaryAction={
        <Button onClick={(): void => setOpen(false)}>Abbrechen</Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      className={{ content: 'w-[40rem] h-max self-center pt-0' }}
    >
      <div>
        <H2>Micro-Session löschen</H2>
        <div>
          Sind Sie sich sicher, dass Sie die folgende Micro-Session löschen
          möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Das Löschen einer Micro-Session ist nur möglich, solange sie noch
          nicht läuft und in einem Kurs genutzt wird. Gelöschte Micro-Sessions
          können nicht zu einem späteren Zeitpunkt wiederhergestellt werden.
        </div>
      </div>
    </Modal>
  )
}

export default MicroSessionDeletionModal
