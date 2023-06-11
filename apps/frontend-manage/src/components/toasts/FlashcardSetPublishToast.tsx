import { Toast } from '@uzh-bf/design-system'

interface FlashcardSetPublishToastProps {
  failed: boolean
  newPublish: boolean
  open: boolean
  setOpen: (open: boolean) => void
}

function FlashcardSetPublishToast({
  failed,
  newPublish,
  open,
  setOpen,
}: FlashcardSetPublishToastProps): React.ReactElement {
  return (
    <Toast
      duration={6000}
      openExternal={open}
      setOpenExternal={setOpen}
      type={failed ? 'error' : 'success'}
    >
      {failed && newPublish && (
        <div>
          Leider ist beim publizieren Ihres Flashcard Sets ein Fehler
          aufgetreten. Versuchen Sie es bitte erneut.
        </div>
      )}
      {failed && !newPublish && (
        <div>
          Leider ist beim umstellen des Status Ihres Flashcard Sets auf `Draft`
          ein Fehler aufgetreten. Versuchen Sie es bitte erneut.
        </div>
      )}
      {!failed && newPublish && (
        <div>
          Ihr Flashcard Set wurde erfolgreich publiziert. Die Studierenden Ihres
          Kurses können dieses nun verwenden.
        </div>
      )}
      {!failed && !newPublish && (
        <div>
          Ihr Flashcard Set wurde erfolgreich auf `Draft` gesetzt. Die
          Studierenden Ihres Kurses können dieses nun nicht mehr verwenden.
        </div>
      )}
    </Toast>
  )
}

export default FlashcardSetPublishToast
