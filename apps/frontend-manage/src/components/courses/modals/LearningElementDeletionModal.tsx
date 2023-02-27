import { useMutation } from '@apollo/client'
import {
  DeleteLearningElementDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, H3, Modal, ThemeContext } from '@uzh-bf/design-system'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface LearningElementDeletionModalProps {
  elementId: string
  title: string
  open: boolean
  setOpen: (value: boolean) => void
}

function LearningElementDeletionModal({
  elementId,
  title,
  open,
  setOpen,
}: LearningElementDeletionModalProps) {
  const theme = useContext(ThemeContext)

  // TODO: implement more efficiently with working update instead of expensive refetch
  const [deleteLearningElement] = useMutation(DeleteLearningElementDocument, {
    variables: { id: elementId },
    refetchQueries: [GetSingleCourseDocument],
  })

  return (
    <Modal
      onPrimaryAction={
        <Button
          onClick={async () => {
            await deleteLearningElement()
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
        <H2>Lernelement löschen</H2>
        <div>
          Sind Sie sich sicher, dass Sie das folgende Lernelement löschen
          möchten?
        </div>
        <div className="p-2 mt-1 border border-solid rounded border-uzh-grey-40">
          <H3>{title}</H3>
        </div>
        <div className="mt-6 mb-2 text-sm italic">
          Das Löschen eines Lernelements ist nur möglich, solange es nicht in
          einem aktiven Kurs verwendet wird. Gelöschte Lernelemente können nicht
          zu einem späteren Zeitpunkt wiederhergestellt werden.
        </div>
      </div>
    </Modal>
  )
}

export default LearningElementDeletionModal
