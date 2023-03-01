import { useMutation } from '@apollo/client'
import {
  PublishLearningElementDocument,
  PublishMicroSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal, ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

const LABELS = {
  LEARNING_ELEMENT: 'Lernelement',
  MICRO_SESSION: 'Micro-Session',
}
interface PublishConfirmationModalProps {
  elementType: 'LEARNING_ELEMENT' | 'MICRO_SESSION'
  elementId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function PublishConfirmationModal({
  elementType,
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
  const [publishMicroSession] = useMutation(PublishMicroSessionDocument, {
    variables: {
      id: elementId,
    },
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            if (elementType === 'MICRO_SESSION') {
              await publishMicroSession()
            } else if (elementType === 'LEARNING_ELEMENT') {
              await publishLearningElement()
            }
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
        <H2>{LABELS[elementType]} publizieren</H2>
        <div>
          Sind Sie sich sicher, dass Sie das folgende Element publizieren
          möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Das Publizieren eines Lernelements oder einer Micro-Session macht das
          Element für alle Teilnehmenden sichtbar. Dieser Prozess kann nicht
          rückgängig gemacht werden. Änderungen am Inhalt eines Elements können
          nach dem Publizieren nicht mehr vorgenommen werden.
          {elementType === 'MICRO_SESSION' &&
            'Micro-Sessions sind ausserdem nur innerhalb des spezifizierten Datumsbereichs sichtbar.'}
        </div>
      </div>
    </Modal>
  )
}

export default PublishConfirmationModal
