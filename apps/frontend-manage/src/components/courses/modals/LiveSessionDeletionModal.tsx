import { Button, H2, H3, Modal } from '@uzh-bf/design-system'
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
        <H2>Live-Session löschen</H2>
        <div>
          Sind Sie sich sicher, dass Sie die folgende Live-Session löschen
          möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Das Löschen einer Live-Session ist nur möglich, solange sie nicht
          bereits gestartet wurde. Gelöschte Live-Sessions können nicht zu einem
          späteren Zeitpunkt wiederhergestellt werden.
        </div>
      </div>
    </Modal>
  )
}

export default LiveSessionDeletionModal
