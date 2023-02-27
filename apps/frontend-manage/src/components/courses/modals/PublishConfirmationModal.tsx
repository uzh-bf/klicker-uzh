import { useMutation } from '@apollo/client'
import { PublishLearningElementDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal, ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface PublishConfirmationModalProps {
  elementId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function PublishConfirmationModal({
  elementId,
  title,
  open,
  setOpen,
}: PublishConfirmationModalProps) {
  const theme = useContext(ThemeContext)
  const [publishLearningElement] = useMutation(PublishLearningElementDocument, {
    variables: {
      id: elementId,
    },
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await publishLearningElement()
            setOpen(false)
          }}
          className={{
            root: twMerge('font-bold text-white', theme.primaryBgDark),
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
        <H2>Lernelement publizieren</H2>
        <div>
          Sind Sie sich sicher, dass Sie das folgende Lernelement publizieren
          möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Das Publizieren eines Lernelements macht es für alle Teilnehmenden
          sichtbar und dieser Prozess kann nicht rückgängig gemacht werden.
          Änderungen am Inhalt des Lernelements können nach dem Publizieren
          nicht mehr vorgenommen werden.
        </div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
